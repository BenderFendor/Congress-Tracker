use chrono::Datelike;
use clap::Parser;
use rand::Rng;
use sha2::{Digest, Sha256};
use sqlx::{postgres::PgPoolOptions, PgPool, Postgres, Transaction};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use std::time::Instant;
use tokio::process::Command as TokioCommand;
use tokio::task::JoinSet;
use tracing::{info, warn};

pub mod job_policy;
pub mod parsers;

use job_policy::{
    download_disposition, retry_delay_seconds, retry_disposition, senate_refresh_enabled,
    DownloadDisposition, RetryDisposition,
};

struct ParsedDocument {
    transactions: Vec<intel_backend::disclosures::ParsedPtrTransaction>,
    annual: Option<intel_backend::annual_disclosures::ParsedAnnualReport>,
}

type WorkerError = Box<dyn std::error::Error + Send + Sync>;

#[derive(Parser)]
#[command(name = "intel_worker")]
struct Cli {
    #[arg(long, default_value_t = false)]
    backfill: bool,
}

fn storage_dir() -> PathBuf {
    if let Ok(base) = std::env::var("WORKER_STORAGE_DIR") {
        return PathBuf::from(base);
    }
    let external = PathBuf::from("/mnt/Big storage/congress-tracker/worker_storage");
    if external.parent().is_some_and(|parent| parent.is_dir()) {
        external
    } else {
        PathBuf::from("./worker_storage")
    }
}

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL required");
    let instance_id = uuid::Uuid::new_v4().to_string();

    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(10))
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    sqlx::migrate!("../intel_backend/migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    std::fs::create_dir_all(storage_dir()).expect("Failed to create worker storage directory");
    recover_stale_jobs(&pool)
        .await
        .expect("Failed to recover stale ingest jobs");
    let recovered = recover_missing_supported_jobs(&pool)
        .await
        .expect("Failed to recover missing supported-form jobs");
    defer_non_core_downloads(&pool)
        .await
        .expect("Failed to prioritize core disclosure jobs");
    let unsupported = classify_pending_unsupported_forms(&pool)
        .await
        .expect("Failed to classify unsupported disclosure forms");

    tokio::spawn(heartbeat_loop(pool.clone(), instance_id.clone()));

    info!(
        instance_id,
        unsupported,
        recovered_downloads = recovered.download_jobs,
        recovered_parses = recovered.parse_jobs,
        "Worker started"
    );

    let mut discovery_tick = tokio::time::interval(Duration::from_secs(1800));
    let mut download_tick = tokio::time::interval(Duration::from_secs(10));
    let mut parse_tick = tokio::time::interval(Duration::from_secs(10));
    let resolve_seconds = std::env::var("RESOLVE_INTERVAL_SECONDS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(300)
        .max(60);
    let mut resolve_tick = tokio::time::interval(Duration::from_secs(resolve_seconds));
    let profile_refresh_seconds = std::env::var("PROFILE_EVIDENCE_REFRESH_SECONDS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(21_600)
        .max(60);
    let mut profile_refresh_tick =
        tokio::time::interval(Duration::from_secs(profile_refresh_seconds));
    let fec_refresh_seconds: u64 = std::env::var("FEC_BULK_REFRESH_SECONDS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(21_600)
        .max(3600);
    let mut fec_bulk_tick = tokio::time::interval(Duration::from_secs(fec_refresh_seconds));
    let senate_refresh_seconds = std::env::var("SENATE_EFD_REFRESH_SECONDS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(21_600)
        .max(3_600);
    let mut senate_efd_tick = tokio::time::interval(Duration::from_secs(senate_refresh_seconds));
    let mut sec_crosswalk_tick = tokio::time::interval(Duration::from_secs(30 * 24 * 60 * 60));

    loop {
        tokio::select! {
            _ = discovery_tick.tick() => {
                let discovery_pool = pool.clone();
                let backfill = cli.backfill;
                tokio::spawn(async move {
                    if let Err(error) = run_discovery(&discovery_pool, backfill).await {
                        warn!(error = %error, "Discovery step failed");
                    }
                    match recover_missing_supported_jobs(&discovery_pool).await {
                        Ok(counts) if counts.download_jobs > 0 || counts.parse_jobs > 0 => {
                            info!(
                                recovered_downloads = counts.download_jobs,
                                recovered_parses = counts.parse_jobs,
                                "Recovered missing supported-form jobs after discovery"
                            );
                        }
                        Ok(_) => {}
                        Err(error) => warn!(error = %error, "Supported-form recovery sweep failed"),
                    }
                });
            }
            _ = download_tick.tick() => {
                if let Err(e) = run_downloads(&pool, &instance_id).await {
                    warn!(error = %e, "Download step failed");
                }
            }
            _ = parse_tick.tick() => {
                if let Err(e) = run_parses(&pool, &instance_id).await {
                    warn!(error = %e, "Parse step failed");
                }
            }
            _ = resolve_tick.tick() => {
                if let Err(e) = run_resolve(&pool).await {
                    warn!(error = %e, "Resolve step failed");
                }
            }
            _ = profile_refresh_tick.tick() => {
                if cli.backfill { continue; }
                let refresh_pool = pool.clone();
                tokio::spawn(async move {
                    if let Err(e) = run_profile_evidence_refresh(&refresh_pool).await {
                        warn!(error = %e, "All-member profile evidence refresh failed");
                    }
                });
            }
            _ = fec_bulk_tick.tick() => {
                if cli.backfill { continue; }
                let refresh_pool = pool.clone();
                tokio::spawn(async move {
                    if let Err(e) = run_fec_bulk_refresh(&refresh_pool).await {
                        warn!(error = %e, "FEC bulk refresh failed");
                    }
                });
            }
            _ = senate_efd_tick.tick() => {
                if cli.backfill || !senate_refresh_enabled(std::env::var("SENATE_EFD_ACCEPT_TERMS").ok().as_deref()) {
                    continue;
                }
                let refresh_pool = pool.clone();
                tokio::spawn(async move {
                    if let Err(error) = run_senate_efd_refresh(&refresh_pool).await {
                        warn!(error = %error, "Senate eFD refresh failed");
                    }
                });
            }
            _ = sec_crosswalk_tick.tick() => {
                if cli.backfill { continue; }
                let refresh_pool = pool.clone();
                tokio::spawn(async move {
                    if let Err(error) = run_sec_crosswalk_refresh(&refresh_pool).await {
                        warn!(error = %error, "SEC asset crosswalk failed");
                    }
                });
            }
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
struct RecoveryCounts {
    download_jobs: u64,
    parse_jobs: u64,
}

const RECOVER_DOWNLOAD_SQL: &str = r#"INSERT INTO ingest_jobs
    (job_type, source_name, source_year, source_document_id, priority)
    SELECT 'download_document', entries.source_name, entries.source_year,
           entries.source_document_id,
           CASE WHEN entries.source_year = $1 THEN $2 ELSE $3 END
    FROM source_index_entries entries
    WHERE entries.source_name = 'house_clerk'
      AND entries.filing_type_code IN ('A', 'O', 'N', 'T', 'P')
      AND NOT EXISTS (
        SELECT 1 FROM ingest_jobs jobs
        WHERE jobs.job_type = 'download_document'
          AND jobs.source_name = entries.source_name
          AND jobs.source_year = entries.source_year
          AND jobs.source_document_id = entries.source_document_id
      )
    ON CONFLICT DO NOTHING"#;

const RECOVER_PARSE_SQL: &str = r#"INSERT INTO ingest_jobs
    (job_type, source_name, source_year, source_document_id,
     document_version_id, priority)
    SELECT 'parse_document', entries.source_name, entries.source_year,
           entries.source_document_id, versions.id,
           CASE WHEN entries.source_year = $1 THEN $2 ELSE $3 END
    FROM source_index_entries entries
    JOIN disclosure_documents documents
      ON documents.source = 'house_disclosures'
     AND documents.source_record_id = entries.source_document_id
    JOIN document_versions versions ON versions.document_id = documents.document_id
    WHERE entries.source_name = 'house_clerk'
      AND entries.filing_type_code IN ('A', 'O', 'N', 'T', 'P')
      AND NOT EXISTS (
        SELECT 1 FROM ingest_jobs jobs
        WHERE jobs.job_type = 'parse_document'
          AND jobs.document_version_id = versions.id
      )
    ON CONFLICT DO NOTHING"#;

fn recovery_priorities(job_type: &str) -> (i32, i32) {
    match job_type {
        "download_document" => (-100, 0),
        "parse_document" => (-90, 10),
        _ => (0, 0),
    }
}

/// Repair an interrupted index-to-job handoff through the normal worker
/// lifecycle. Both inserts are idempotent: any historical job, including a
/// terminal failure, is evidence that the handoff already occurred.
async fn recover_missing_supported_jobs(pool: &PgPool) -> Result<RecoveryCounts, sqlx::Error> {
    let current_year = chrono::Utc::now().year();
    let (current_download_priority, historical_download_priority) =
        recovery_priorities("download_document");
    let downloads = sqlx::query(RECOVER_DOWNLOAD_SQL)
        .bind(current_year)
        .bind(current_download_priority)
        .bind(historical_download_priority)
        .execute(pool)
        .await?
        .rows_affected();

    let (current_parse_priority, historical_parse_priority) = recovery_priorities("parse_document");
    let parses = sqlx::query(RECOVER_PARSE_SQL)
        .bind(current_year)
        .bind(current_parse_priority)
        .bind(historical_parse_priority)
        .execute(pool)
        .await?
        .rows_affected();

    Ok(RecoveryCounts {
        download_jobs: downloads,
        parse_jobs: parses,
    })
}

async fn run_profile_evidence_refresh(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    const LOCK_KEY: i64 = 70_311_942_026;
    let mut lock_connection = pool.acquire().await?;
    let locked: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
        .bind(LOCK_KEY)
        .fetch_one(&mut *lock_connection)
        .await?;
    if !locked {
        info!("Profile evidence refresh already running on another worker");
        return Ok(());
    }

    info!("Starting scheduled all-member profile evidence refresh");
    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());
    let mut command = TokioCommand::new(cargo);
    command
        .args([
            "run",
            "-p",
            "intel_backend",
            "--bin",
            "ingest",
            "--",
            "profile-evidence-all",
        ])
        .kill_on_drop(true);
    let result = tokio::time::timeout(Duration::from_secs(7_200), command.status()).await;

    let _: bool = sqlx::query_scalar("SELECT pg_advisory_unlock($1)")
        .bind(LOCK_KEY)
        .fetch_one(&mut *lock_connection)
        .await?;

    match result {
        Ok(Ok(status)) if status.success() => {
            info!("Scheduled all-member profile evidence refresh completed");
            Ok(())
        }
        Ok(Ok(status)) => Err(format!("profile evidence ingest exited with {status}").into()),
        Ok(Err(error)) => Err(error.into()),
        Err(_) => Err("profile evidence ingest exceeded the two-hour timeout".into()),
    }
}

// ── FEC Bulk ZIP refresh (scheduled) ────────────────────────────────────────

/// Check and refresh FEC bulk ZIP data periodically.
///
/// The current cycle is not enough to cover every sitting member: candidate
/// master and committee linkage files are election-cycle scoped, while the
/// member registry spans incumbents whose most recent campaign was earlier.
/// Refresh the current cycle plus the two preceding even cycles by default.
/// Operators can override this with FEC_CYCLES=2022,2024,2026.
async fn run_fec_bulk_refresh(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    const FEC_BULK_LOCK: i64 = 42_042_042_042;
    let mut lock_connection = pool.acquire().await?;
    let locked: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
        .bind(FEC_BULK_LOCK)
        .fetch_one(&mut *lock_connection)
        .await?;
    if !locked {
        info!("FEC bulk refresh already running on another worker");
        return Ok(());
    }

    info!("Starting scheduled FEC bulk refresh");
    let current_cycle = {
        let year = chrono::Utc::now().year();
        if year % 2 == 0 {
            year
        } else {
            year - 1
        }
    };
    let cycles = std::env::var("FEC_CYCLES").unwrap_or_else(|_| {
        let start = current_cycle.saturating_sub(4);
        format!("{start},{},{}", start + 2, current_cycle)
    });
    let binary =
        std::env::var("INTEL_INGEST_BIN").unwrap_or_else(|_| "target/debug/ingest".to_string());
    let mut command = TokioCommand::new(binary);
    command
        .args(["fec-bulk", "--cycles", &cycles])
        .env("FEC_ARCHIVE_DIR", storage_dir().join("fec"))
        .kill_on_drop(true);

    let result = tokio::time::timeout(Duration::from_secs(7_200), command.status()).await;

    let _: bool = sqlx::query_scalar("SELECT pg_advisory_unlock($1)")
        .bind(FEC_BULK_LOCK)
        .fetch_one(&mut *lock_connection)
        .await?;

    match result {
        Ok(Ok(status)) if status.success() => {
            info!("Scheduled FEC bulk refresh completed");
            Ok(())
        }
        Ok(Ok(status)) => Err(format!("fec-bulk ingest exited with {status}").into()),
        Ok(Err(error)) => Err(error.into()),
        Err(_) => Err("fec-bulk ingest exceeded the two-hour timeout".into()),
    }
}

async fn run_senate_efd_refresh(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    if !senate_refresh_enabled(std::env::var("SENATE_EFD_ACCEPT_TERMS").ok().as_deref()) {
        info!("Senate eFD refresh disabled until operator accepts source terms");
        return Ok(());
    }
    const SENATE_EFD_LOCK: i64 = 34_034_034_034;
    let mut lock_connection = pool.acquire().await?;
    let locked: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
        .bind(SENATE_EFD_LOCK)
        .fetch_one(&mut *lock_connection)
        .await?;
    if !locked {
        info!("Senate eFD refresh already running on another worker");
        return Ok(());
    }
    let binary =
        std::env::var("INTEL_INGEST_BIN").unwrap_or_else(|_| "target/debug/ingest".to_string());
    let result = tokio::time::timeout(
        Duration::from_secs(1_800),
        TokioCommand::new(binary)
            .args(["senate-efd"])
            .env("DATABASE_URL", std::env::var("DATABASE_URL")?)
            .status(),
    )
    .await;
    let _: bool = sqlx::query_scalar("SELECT pg_advisory_unlock($1)")
        .bind(SENATE_EFD_LOCK)
        .fetch_one(&mut *lock_connection)
        .await?;
    match result {
        Ok(Ok(status)) if status.success() => Ok(()),
        Ok(Ok(status)) => Err(format!("senate-efd exited with {status}").into()),
        Ok(Err(error)) => Err(error.into()),
        Err(_) => Err("senate-efd exceeded the 30-minute timeout".into()),
    }
}

async fn run_sec_crosswalk_refresh(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    const SEC_LOCK: i64 = 53_053_053_053;
    let mut lock_connection = pool.acquire().await?;
    let locked: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
        .bind(SEC_LOCK)
        .fetch_one(&mut *lock_connection)
        .await?;
    if !locked {
        return Ok(());
    }
    let binary =
        std::env::var("INTEL_INGEST_BIN").unwrap_or_else(|_| "target/debug/ingest".to_string());
    let result = tokio::time::timeout(
        Duration::from_secs(900),
        TokioCommand::new(binary)
            .args(["sec-asset-crosswalk"])
            .env("DATABASE_URL", std::env::var("DATABASE_URL")?)
            .status(),
    )
    .await;
    let _: bool = sqlx::query_scalar("SELECT pg_advisory_unlock($1)")
        .bind(SEC_LOCK)
        .fetch_one(&mut *lock_connection)
        .await?;
    match result {
        Ok(Ok(status)) if status.success() => Ok(()),
        Ok(Ok(status)) => Err(format!("sec-asset-crosswalk exited with {status}").into()),
        Ok(Err(error)) => Err(error.into()),
        Err(_) => Err("sec-asset-crosswalk exceeded the 15-minute timeout".into()),
    }
}
// ── Discovery ────────────────────────────────────────────────────────────────

/// Advisory lock key helper — deterministic hash of a string.
fn lock_key(s: &str) -> i64 {
    s.as_bytes()
        .iter()
        .fold(0i64, |a, &b| a.wrapping_mul(31).wrapping_add(b as i64))
}

/// Download the House Clerk yearly index ZIP, parse its tab-separated index,
/// and enqueue supported documents that have not been seen before.
async fn run_discovery(pool: &PgPool, backfill: bool) -> Result<(), WorkerError> {
    let current_year = chrono::Utc::now().year();
    let configured_start = std::env::var("DISCLOSURE_START_YEAR")
        .ok()
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or(current_year - 5)
        .clamp(2008, current_year);
    let start_year = if backfill {
        std::env::var("DISCLOSURE_BACKFILL_START_YEAR")
            .ok()
            .and_then(|value| value.parse::<i32>().ok())
            .unwrap_or(configured_start)
            .clamp(2008, current_year)
    } else {
        configured_start
    };
    let mut years: Vec<i32> = (start_year..=current_year).rev().collect();
    // Discovery is deliberately incremental in backfill mode. One large ZIP
    // index must not monopolize the event loop while downloads and parsers
    // drain the jobs already discovered.
    if backfill {
        let mut next_year = None;
        for year in &years {
            let done: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM source_runs WHERE source = 'house_clerk_index' AND endpoint = $1 AND status = 'success')",
            )
            .bind(format!("/{year}FD.zip"))
            .fetch_one(pool)
            .await?;
            if !done {
                next_year = Some(*year);
                break;
            }
        }
        years = next_year.into_iter().collect();
    }

    for year in years {
        if !backfill && year < current_year {
            let recently_discovered: bool = sqlx::query_scalar(
                "SELECT EXISTS(
                   SELECT 1 FROM source_runs
                   WHERE source = 'house_clerk_index'
                     AND endpoint = $1
                     AND status = 'success'
                     AND started_at > now() - interval '7 days'
                 )",
            )
            .bind(format!("/{year}FD.zip"))
            .fetch_one(pool)
            .await?;
            if recently_discovered {
                continue;
            }
        }
        let lock = lock_key(&format!("house_clerk_{}", year));
        let mut lock_connection = pool.acquire().await?;
        let locked: (bool,) = sqlx::query_as("SELECT pg_try_advisory_lock($1)")
            .bind(lock)
            .fetch_one(&mut *lock_connection)
            .await?;
        if !locked.0 {
            continue; // another worker is already discovering this year
        }

        info!(year, "Discovering House Clerk index");
        let run_id: uuid::Uuid = sqlx::query_scalar(
            "INSERT INTO source_runs (source, endpoint, params)
             VALUES ('house_clerk_index', $1, jsonb_build_object('year', $2))
             RETURNING id",
        )
        .bind(format!("/{year}FD.zip"))
        .bind(year)
        .fetch_one(pool)
        .await?;
        match discover_year(pool, year).await {
            Ok((seen, written)) => {
                sqlx::query(
                    "UPDATE source_runs
                     SET status = 'success', rows_seen = $1, rows_written = $2, finished_at = now()
                     WHERE id = $3",
                )
                .bind(seen as i64)
                .bind(written as i64)
                .bind(run_id)
                .execute(pool)
                .await?;
                info!(year, seen, new = written, "Discovery complete");
            }
            Err(e) => {
                sqlx::query(
                    "UPDATE source_runs
                     SET status = 'failed', error_message = $1, finished_at = now()
                     WHERE id = $2",
                )
                .bind(e.to_string())
                .bind(run_id)
                .execute(pool)
                .await?;
                warn!(year, error = %e, "Discovery failed for year");
            }
        }

        let _: bool = sqlx::query_scalar("SELECT pg_advisory_unlock($1)")
            .bind(lock)
            .fetch_one(&mut *lock_connection)
            .await?;
    }
    Ok(())
}

async fn discover_year(pool: &PgPool, year: i32) -> Result<(usize, usize), WorkerError> {
    let url = format!(
        "https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{}FD.zip",
        year
    );
    let resp = http_client().get(&url).send().await?.error_for_status()?;
    let bytes = resp.bytes().await?;

    // Write to temp file for unzip
    let tmp = std::env::temp_dir().join(format!("clerk_{}_FD.zip", year));
    std::fs::write(&tmp, &bytes)?;

    // The Clerk names this file .txt, but its public format is tab-separated.
    let index_name = format!("{}FD.txt", year);
    let output = Command::new("unzip")
        .args(["-p", tmp.to_str().unwrap(), &index_name])
        .output()?;
    let _ = std::fs::remove_file(&tmp);

    if !output.status.success() {
        return Err(format!("unzip failed for year {}: {}", year, output.status).into());
    }
    let index_text = String::from_utf8_lossy(&output.stdout);
    let mut seen_entries = 0usize;
    let mut new_entries = 0usize;

    for (line_index, line) in index_text.lines().enumerate().skip(1) {
        if line.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = line.trim_end_matches('\r').split('\t').collect();
        let Some(entry) = IndexEntry::from_fields(&fields) else {
            warn!(
                year,
                line = line_index + 1,
                fields = fields.len(),
                "Malformed Clerk index row"
            );
            continue;
        };
        seen_entries += 1;
        if insert_index_entry(pool, year, &entry, line).await? {
            new_entries += 1;
        }
    }

    Ok((seen_entries, new_entries))
}

struct IndexEntry {
    first: String,
    last: String,
    state_dst: String,
    filing_type: String,
    filing_date: String,
    doc_id: String,
}

impl IndexEntry {
    fn from_fields(fields: &[&str]) -> Option<Self> {
        if fields.len() < 9 || fields[8].trim().is_empty() {
            return None;
        }
        Some(Self {
            last: fields[1].trim().to_string(),
            first: fields[2].trim().to_string(),
            filing_type: fields[4].trim().to_string(),
            state_dst: fields[5].trim().to_string(),
            filing_date: fields[7].trim().to_string(),
            doc_id: fields[8].trim().to_string(),
        })
    }
}

/// Insert an index entry and enqueue a download job if it is new.
/// Returns true if this is a genuinely new entry.
async fn insert_index_entry(
    pool: &PgPool,
    year: i32,
    entry: &IndexEntry,
    raw_row: &str,
) -> Result<bool, sqlx::Error> {
    let filing_date: Option<chrono::NaiveDate> =
        chrono::NaiveDate::parse_from_str(&entry.filing_date, "%m/%d/%Y").ok();

    let result = sqlx::query(
        r#"INSERT INTO source_index_entries
           (source_name, source_year, source_document_id, filing_type_code,
            first_name, last_name, state_district, filing_date, raw_xml)
           VALUES ('house_clerk', $1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING"#,
    )
    .bind(year)
    .bind(&entry.doc_id)
    .bind(&entry.filing_type)
    .bind(&entry.first)
    .bind(&entry.last)
    .bind(&entry.state_dst)
    .bind(filing_date)
    .bind(raw_row)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Ok(false); // already existed
    }

    // Preserve and enqueue every filing type. Annual, new-member, termination,
    // candidate, PTR, amendment, and extension documents all remain immutable
    // source evidence even when a parser later sends a row to review.
    sqlx::query(
        r#"INSERT INTO ingest_jobs
           (job_type, source_name, source_year, source_document_id, priority)
           VALUES ('download_document', 'house_clerk', $1, $2, 0)
           ON CONFLICT DO NOTHING"#,
    )
    .bind(year)
    .bind(&entry.doc_id)
    .execute(pool)
    .await?;

    Ok(true)
}

// ── Downloads ────────────────────────────────────────────────────────────────

/// Client with a User-Agent the Clerk expects.
fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(
            "CongressTracker/1.0 (public-interest research; https://github.com/congress-tracker)",
        )
        .timeout(Duration::from_secs(120))
        .build()
        .expect("Failed to build HTTP client")
}

async fn run_downloads(pool: &PgPool, instance_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    let concurrency = std::env::var("DOWNLOAD_CONCURRENCY")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(6)
        .clamp(1, 16);
    let jobs: Vec<(i64, i32, String)> = sqlx::query_as(&format!(
        "WITH picked AS (
           SELECT id FROM ingest_jobs
           WHERE job_type = 'download_document'
             AND status = 'pending'
             AND attempts < max_attempts
             AND available_at <= now()
           ORDER BY priority, created_at
           LIMIT {limit}
           FOR UPDATE SKIP LOCKED
         )
         UPDATE ingest_jobs AS jobs
         SET status = 'running', locked_by = $1, locked_at = now()
         FROM picked
         WHERE jobs.id = picked.id
         RETURNING jobs.id, jobs.source_year, jobs.source_document_id",
        limit = concurrency * 2
    ))
    .bind(instance_id)
    .fetch_all(pool)
    .await?;

    let client = http_client();

    let batch_size = jobs.len();
    let started = Instant::now();
    let mut tasks = JoinSet::new();
    for (job_id, year, doc_id) in jobs {
        let task_client = client.clone();
        let task_pool = pool.clone();
        tasks.spawn(async move {
            if let Err(error) = download_one(&task_client, &task_pool, job_id, year, &doc_id).await
            {
                warn!(job_id, error = %error, "Download failed");
                if let Err(retry_error) =
                    retry_job(&task_pool, job_id, &error.to_string(), None).await
                {
                    warn!(job_id, error = %retry_error, "Failed to schedule download retry");
                }
            }
        });
        if tasks.len() >= concurrency {
            let _ = tasks.join_next().await;
        }
    }
    while tasks.join_next().await.is_some() {}
    let elapsed_ms = started.elapsed().as_millis();
    let documents_per_minute = if elapsed_ms == 0 {
        0.0
    } else {
        batch_size as f64 * 60_000.0 / elapsed_ms as f64
    };
    info!(
        batch_size,
        elapsed_ms, documents_per_minute, concurrency, "Download batch complete"
    );
    Ok(())
}

/// Keep all source index rows, but give annual/PTR/core filing types priority
/// over candidate and extension records during the first warehouse pass.
async fn defer_non_core_downloads(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"UPDATE ingest_jobs jobs
              SET priority = 50
            FROM source_index_entries entries
           WHERE jobs.job_type = 'download_document'
             AND jobs.status = 'pending'
             AND jobs.source_name = 'house_clerk'
             AND entries.source_name = jobs.source_name
             AND entries.source_year = jobs.source_year
             AND entries.source_document_id = jobs.source_document_id
             AND entries.filing_type_code NOT IN ('A', 'O', 'N', 'T', 'P')
             AND jobs.priority < 50"#,
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn download_one(
    client: &reqwest::Client,
    pool: &PgPool,
    job_id: i64,
    year: i32,
    doc_id: &str,
) -> Result<(), WorkerError> {
    let filing_type: String = sqlx::query_scalar(
        "SELECT filing_type_code FROM source_index_entries
         WHERE source_name = 'house_clerk'
           AND source_year = $1
           AND source_document_id = $2
         LIMIT 1",
    )
    .bind(year)
    .bind(doc_id)
    .fetch_one(pool)
    .await?;
    let directory = if filing_type == "P" {
        "ptr-pdfs"
    } else {
        "financial-pdfs"
    };
    let pdf_url = format!(
        "https://disclosures-clerk.house.gov/public_disc/{}/{}/{}.pdf",
        directory, year, doc_id
    );

    let resp = client.get(&pdf_url).send().await?;
    let status = resp.status();

    match download_disposition(status.as_u16()) {
        DownloadDisposition::NotModified => {
            sqlx::query(
                "UPDATE ingest_jobs SET status = 'skipped', finished_at = now() WHERE id = $1",
            )
            .bind(job_id)
            .execute(pool)
            .await?;
            return Ok(());
        }
        DownloadDisposition::RateLimited => {
            return Err(format!("HTTP {}: rate limited", status.as_u16()).into());
        }
        DownloadDisposition::Failed => {
            return Err(format!("HTTP {} for {}", status.as_u16(), pdf_url).into());
        }
        DownloadDisposition::Success => {}
    }

    let bytes = resp.bytes().await?;
    if !bytes.starts_with(b"%PDF-") {
        return Err(format!("{} did not return a PDF", pdf_url).into());
    }
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let sha256 = format!("{:x}", hasher.finalize());
    let byte_size = bytes.len() as i64;
    let version_dir = storage_dir().join(year.to_string()).join(doc_id);
    std::fs::create_dir_all(&version_dir)?;
    let storage_path = version_dir.join(format!("{sha256}.pdf"));
    if !storage_path.exists() {
        std::fs::write(&storage_path, &bytes)?;
    }

    // Upsert disclosure_document (idempotent)
    sqlx::query(
        r#"INSERT INTO disclosure_documents
           (bioguide_id, chamber, report_type, filing_date, source, source_record_id,
            source_url, raw_sha256, parse_status)
           VALUES (NULL, 'Unknown',
             (SELECT COALESCE(filing_type_code, 'unknown') FROM source_index_entries
              WHERE source_name = 'house_clerk' AND source_document_id = $1 LIMIT 1),
             (SELECT filing_date FROM source_index_entries
              WHERE source_name = 'house_clerk' AND source_document_id = $1 LIMIT 1),
             'house_disclosures', $1, $2, $3, 'pending')
           ON CONFLICT (source, source_record_id) DO UPDATE SET
             raw_sha256 = EXCLUDED.raw_sha256,
             parse_status = CASE
               WHEN disclosure_documents.parse_status = 'parsed' THEN 'parsed'
               ELSE 'pending'
             END"#,
    )
    .bind(doc_id)
    .bind(&pdf_url)
    .bind(&sha256)
    .execute(pool)
    .await?;

    // Get the document_id for version insert
    let doc_row: (i64,) = sqlx::query_as(
        "SELECT document_id FROM disclosure_documents WHERE source = 'house_disclosures' AND source_record_id = $1",
    )
    .bind(doc_id)
    .fetch_one(pool)
    .await?;

    // Insert document version — ON CONFLICT tells us if this SHA is new
    let version_id: Option<i64> = sqlx::query_scalar(
        r#"INSERT INTO document_versions (document_id, sha256, byte_size, storage_key, fetched_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (document_id, sha256) DO NOTHING
           RETURNING id"#,
    )
    .bind(doc_row.0)
    .bind(&sha256)
    .bind(byte_size)
    .bind(storage_path.to_string_lossy().as_ref())
    .fetch_optional(pool)
    .await?;

    if let Some(version_id) = version_id {
        // New version — enqueue parse
        sqlx::query(
            r#"INSERT INTO ingest_jobs
               (job_type, source_name, source_year, source_document_id,
                document_version_id, priority)
               VALUES ('parse_document', 'house_clerk', $1, $2, $3, 10)
               ON CONFLICT DO NOTHING"#,
        )
        .bind(year)
        .bind(doc_id)
        .bind(version_id)
        .execute(pool)
        .await?;
    }

    sqlx::query(
        "UPDATE ingest_jobs
         SET status = 'completed', finished_at = now(), locked_by = NULL, locked_at = NULL
         WHERE id = $1",
    )
    .bind(job_id)
    .execute(pool)
    .await?;

    info!(job_id, doc_id, sha256 = %&sha256[..12], "Downloaded");
    Ok(())
}

// ── Parsing ──────────────────────────────────────────────────────────────────

async fn run_parses(pool: &PgPool, instance_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    let concurrency = std::env::var("PARSE_CONCURRENCY")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(2)
        .clamp(1, 8);
    let jobs: Vec<(i64, i32, String, i64)> = sqlx::query_as(&format!(
        "WITH picked AS (
           SELECT id FROM ingest_jobs
           WHERE job_type = 'parse_document'
             AND status = 'pending'
             AND attempts < max_attempts
             AND available_at <= now()
           ORDER BY priority, created_at
           LIMIT {limit}
           FOR UPDATE SKIP LOCKED
         )
         UPDATE ingest_jobs AS jobs
         SET status = 'running', locked_by = $1, locked_at = now()
         FROM picked
         WHERE jobs.id = picked.id
         RETURNING jobs.id, jobs.source_year, jobs.source_document_id,
                   jobs.document_version_id",
        limit = concurrency * 2
    ))
    .bind(instance_id)
    .fetch_all(pool)
    .await?;

    let batch_size = jobs.len();
    let started = Instant::now();
    let mut tasks = JoinSet::new();
    for (job_id, year, doc_id, version_id) in jobs {
        let task_pool = pool.clone();
        tasks.spawn(async move {
            if let Err(error) = parse_one(&task_pool, job_id, year, &doc_id, version_id).await {
                warn!(job_id, doc_id, error = %error, "Parse failed");
                if let Err(retry_error) =
                    retry_job(&task_pool, job_id, &error.to_string(), Some(3600)).await
                {
                    warn!(job_id, error = %retry_error, "Failed to schedule parse retry");
                }
            }
        });
        if tasks.len() >= concurrency {
            let _ = tasks.join_next().await;
        }
    }
    while tasks.join_next().await.is_some() {}
    let elapsed_ms = started.elapsed().as_millis();
    let documents_per_minute = if elapsed_ms == 0 {
        0.0
    } else {
        batch_size as f64 * 60_000.0 / elapsed_ms as f64
    };
    info!(
        batch_size,
        elapsed_ms, documents_per_minute, concurrency, "Parse batch complete"
    );
    Ok(())
}

async fn parse_one(
    pool: &PgPool,
    job_id: i64,
    source_year: i32,
    doc_id: &str,
    version_id: i64,
) -> Result<(), WorkerError> {
    // Get document info
    let doc: (i64, String, String) = sqlx::query_as(
        "SELECT document_id, source_url, report_type FROM disclosure_documents
         WHERE source = 'house_disclosures' AND source_record_id = $1",
    )
    .bind(doc_id)
    .fetch_one(pool)
    .await?;
    let (document_id, pdf_url, report_type) = doc;
    let (stored_document_id, storage_key): (i64, Option<String>) =
        sqlx::query_as("SELECT document_id, storage_key FROM document_versions WHERE id = $1")
            .bind(version_id)
            .fetch_one(pool)
            .await?;
    if stored_document_id != document_id {
        return Err(
            format!("version {version_id} does not belong to document {document_id}").into(),
        );
    }
    let pdf_path = storage_key.ok_or_else(|| format!("version {version_id} has no storage key"))?;
    if !std::path::Path::new(&pdf_path).is_file() {
        return Err(format!("stored PDF is missing: {pdf_path}").into());
    }

    if !supported_house_filing_type(&report_type) {
        let reason = format!("unsupported House Clerk filing type {report_type}");
        sqlx::query(
            r#"INSERT INTO parse_attempts
               (document_version_id, parser_name, parser_version, status,
                rows_extracted, error_message, finished_at)
               VALUES ($1, 'unsupported-form', '1.0', 'rejected', 0, $2, now())
               ON CONFLICT DO NOTHING"#,
        )
        .bind(version_id)
        .bind(&reason)
        .execute(pool)
        .await?;
        sqlx::query(
            "UPDATE disclosure_documents SET parse_status='rejected', parse_error=$1 WHERE document_id=$2",
        )
        .bind(&reason)
        .bind(document_id)
        .execute(pool)
        .await?;
        sqlx::query(
            "UPDATE ingest_jobs
             SET status='completed', finished_at=now(), locked_by=NULL, locked_at=NULL,
                 error_message=$1
             WHERE id=$2",
        )
        .bind(&reason)
        .bind(job_id)
        .execute(pool)
        .await?;
        info!(job_id, doc_id, report_type, "Classified unsupported filing");
        return Ok(());
    }

    // Extract text
    let text =
        tokio::task::spawn_blocking(move || parsers::extract_text_with_ocr(&pdf_path)).await??;
    let fingerprinted_layout = parsers::fingerprint(&text);
    // The Clerk index is the authoritative document classification. Current
    // PTR PDFs use embedded fonts that can collapse their title to initials in
    // pdftotext output, so a valid P filing must not depend on title OCR.
    let layout = if report_type == "P" && fingerprinted_layout == parsers::DocumentLayout::Unknown {
        parsers::DocumentLayout::PtrElectronic2022Plus
    } else if matches!(report_type.as_str(), "A" | "O" | "N" | "T")
        && text.contains("Value of Asset")
    {
        parsers::DocumentLayout::AnnualElectronic
    } else {
        fingerprinted_layout
    };

    // Create parse attempt record
    let parser_name = format!("{:?}", layout).to_lowercase().replace('_', "-");
    let (attempt_id,): (i64,) = sqlx::query_as(
        "INSERT INTO parse_attempts (document_version_id, parser_name, parser_version, status)
         VALUES ($1, $2, '1.0', 'running')
         RETURNING id",
    )
    .bind(version_id)
    .bind(&parser_name)
    .fetch_one(pool)
    .await?;

    // Run parser CPU work off the async runtime. OCR and text extraction are
    // already isolated above; this also keeps large regex/layout passes from
    // starving download and database tasks.
    let parse_text = text.clone();
    let parse_result = tokio::task::spawn_blocking(move || {
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| match layout {
            parsers::DocumentLayout::PtrElectronic2022Plus
            | parsers::DocumentLayout::PtrPre2015 => ParsedDocument {
                transactions: parsers::parse_ptr_text(&parse_text),
                annual: None,
            },
            parsers::DocumentLayout::PtrLegacy2015To2021 => ParsedDocument {
                transactions: parsers::parse_ptr_legacy(&parse_text),
                annual: None,
            },
            parsers::DocumentLayout::AnnualElectronic | parsers::DocumentLayout::AnnualScanned => {
                ParsedDocument {
                    transactions: parsers::parse_ptr_text(&parse_text),
                    annual: Some(parsers::parse_annual_electronic(&parse_text)),
                }
            }
            _ => ParsedDocument {
                transactions: Vec::new(),
                annual: None,
            },
        }))
    })
    .await
    .map_err(|error| format!("parser task failed: {error}"))?;

    let parsed = match parse_result {
        Ok(parsed) => parsed,
        Err(_panic) => {
            sqlx::query(
                "UPDATE parse_attempts SET status = 'failed', error_message = 'parser panicked', finished_at = now()
                 WHERE id = $1",
            )
            .bind(attempt_id)
            .execute(pool)
            .await?;
            return Err("parser panicked".into());
        }
    };

    let annual_rows = parsed.annual.as_ref().map_or(0, |annual| {
        annual.assets.len()
            + annual.liabilities.len()
            + annual.income.len()
            + annual.gifts.len()
            + annual.positions.len()
    });
    let rows_extracted = (parsed.transactions.len() + annual_rows) as i32;

    if rows_extracted == 0 && layout == parsers::DocumentLayout::Unknown {
        // Record unknown layout
        sqlx::query(
            "INSERT INTO parse_issues (parse_attempt_id, raw_text, issue_type, issue_detail)
             VALUES ($1, $2, 'unknown_layout', $3)",
        )
        .bind(attempt_id)
        .bind(truncate_utf8(&text, 2000))
        .bind(format!("{:?}", layout))
        .execute(pool)
        .await?;
    }

    // Insert parsed transactions in one transaction. This keeps each filing
    // atomic while avoiding one network round-trip/commit per row.
    let mut transaction = pool.begin().await?;
    for tx in &parsed.transactions {
        sqlx::query(
            r#"INSERT INTO disclosure_transactions
               (document_id, bioguide_id, owner_type, asset_name, ticker,
                transaction_type, amount_min, amount_max,
                transaction_date, disclosure_date, filing_url, raw_json)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '{}'::jsonb)
               ON CONFLICT (document_id, owner_type, asset_name, ticker,
                            transaction_type, transaction_date)
               DO NOTHING"#,
        )
        .bind(document_id)
        .bind(Option::<&str>::None) // bioguide_id resolved later in run_resolve
        .bind(&tx.owner_type)
        .bind(&tx.asset_name)
        .bind(&tx.ticker)
        .bind(&tx.transaction_type)
        .bind(tx.amount_min)
        .bind(tx.amount_max)
        .bind(tx.transaction_date)
        .bind(tx.disclosure_date)
        .bind(&pdf_url) // filing_url from the source document
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;

    if let Some(annual) = parsed.annual.as_ref() {
        persist_annual_report(pool, document_id, version_id, source_year, &pdf_url, annual).await?;
    }

    let (attempt_status, document_status, parse_error): (&str, &str, Option<&str>) =
        if rows_extracted > 0 {
            ("success", "parsed", None)
        } else if layout == parsers::DocumentLayout::Unknown {
            ("failed", "rejected", Some("unknown document layout"))
        } else {
            (
                "partial",
                "partial",
                Some("recognized layout produced no transaction rows"),
            )
        };

    // Mark parse complete without presenting a zero-row parse as success.
    sqlx::query(
        "UPDATE parse_attempts
         SET status = $1, rows_extracted = $2, error_message = $3, finished_at = now()
         WHERE id = $4",
    )
    .bind(attempt_status)
    .bind(rows_extracted)
    .bind(parse_error)
    .bind(attempt_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "UPDATE disclosure_documents
         SET parse_status = $1, parse_error = $2
         WHERE document_id = $3",
    )
    .bind(document_status)
    .bind(parse_error)
    .bind(document_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "UPDATE ingest_jobs
         SET status = 'completed', finished_at = now(), locked_by = NULL, locked_at = NULL
         WHERE id = $1",
    )
    .bind(job_id)
    .execute(pool)
    .await?;

    info!(job_id, doc_id, rows = rows_extracted, "Parsed");
    Ok(())
}

fn supported_house_filing_type(report_type: &str) -> bool {
    matches!(report_type, "P" | "A" | "O" | "N" | "T")
}

async fn persist_annual_report(
    pool: &PgPool,
    document_id: i64,
    document_version_id: i64,
    source_year: i32,
    source_url: &str,
    report: &intel_backend::annual_disclosures::ParsedAnnualReport,
) -> Result<(), WorkerError> {
    let reporting_year = report.filing_year.unwrap_or(source_year);
    let filing_id: i64 = sqlx::query_scalar(
        r#"INSERT INTO disclosure_filings
           (document_id, document_version_id, filing_type, source_filing_type_code,
            filing_date, reporting_period_start, reporting_period_end, raw_json)
           VALUES ($1, $2, 'annual_report', $3, $4, $5, $6,
                   jsonb_build_object('source_url', $7, 'reporting_year', $8))
           ON CONFLICT (document_version_id) WHERE document_version_id IS NOT NULL
           DO UPDATE SET filing_date = EXCLUDED.filing_date,
                         reporting_period_start = EXCLUDED.reporting_period_start,
                         reporting_period_end = EXCLUDED.reporting_period_end,
                         raw_json = EXCLUDED.raw_json
           RETURNING filing_id"#,
    )
    .bind(document_id)
    .bind(document_version_id)
    .bind(report.filing_type.as_deref())
    .bind(report.filing_date)
    .bind(report.reporting_period_start)
    .bind(report.reporting_period_end)
    .bind(source_url)
    .bind(reporting_year)
    .fetch_one(pool)
    .await?;

    sqlx::query("DELETE FROM disclosure_assets WHERE document_version_id = $1")
        .bind(document_version_id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM disclosure_liabilities WHERE document_version_id = $1")
        .bind(document_version_id)
        .execute(pool)
        .await?;
    for table in [
        "disclosure_income",
        "disclosure_gifts",
        "disclosure_positions",
    ] {
        sqlx::query(&format!(
            "DELETE FROM {table} WHERE document_version_id = $1"
        ))
        .bind(document_version_id)
        .execute(pool)
        .await?;
    }

    for asset in &report.assets {
        let asset_type = asset_type_name(asset.asset_type_code.as_deref());
        let financial_asset_id: i64 = sqlx::query_scalar(
            r#"INSERT INTO financial_assets
               (canonical_name, asset_type, ticker, is_publicly_traded, resolution_status)
               VALUES ($1, $2, $3, $4, 'unresolved')
               ON CONFLICT (canonical_name, asset_type)
               DO UPDATE SET ticker = COALESCE(EXCLUDED.ticker, financial_assets.ticker),
                             updated_at = now()
               RETURNING id"#,
        )
        .bind(&asset.asset_name)
        .bind(asset_type)
        .bind(&asset.ticker)
        .bind(asset.ticker.is_some())
        .fetch_one(pool)
        .await?;
        sqlx::query(
            r#"INSERT INTO disclosure_assets
               (document_version_id, filing_id, owner_type, asset_name, ticker,
                financial_asset_id, asset_type, value_min, value_max,
                value_is_unbounded, as_of_date, raw_text, raw_row,
                parser_name, parser_version, parse_confidence)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                       'house_annual_range', '1.0', 'medium')"#,
        )
        .bind(document_version_id)
        .bind(filing_id)
        .bind(&asset.owner_type)
        .bind(&asset.asset_name)
        .bind(&asset.ticker)
        .bind(financial_asset_id)
        .bind(asset_type)
        .bind(asset.value.minimum)
        .bind(asset.value.maximum)
        .bind(asset.value.is_unbounded)
        .bind(report.reporting_period_end.or(report.filing_date))
        .bind(&asset.raw_text)
        .bind(serde_json::json!({
            "asset_type_code": asset.asset_type_code,
            "range": asset.value.raw,
        }))
        .execute(pool)
        .await?;
        if asset.ticker.is_some() {
            sqlx::query(
                r#"INSERT INTO manual_reviews
                   (review_type, source_table, source_record_id, reason, parser_confidence)
                   VALUES ('asset_identity', 'disclosure_assets', $1, $2, 0.5)
                   ON CONFLICT (review_type, source_table, source_record_id) DO NOTHING"#,
            )
            .bind(format!("{document_version_id}:{}", asset.asset_name))
            .bind("Ticker requires SEC/company identity resolution")
            .execute(pool)
            .await?;
        }
    }

    for liability in &report.liabilities {
        sqlx::query(
            r#"INSERT INTO disclosure_liabilities
               (document_version_id, filing_id, owner_type, creditor_name,
                liability_type, date_incurred, amount_min, amount_max,
                amount_is_unbounded, as_of_date, raw_text, raw_row,
                parser_name, parser_version, parse_confidence)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                       'house_annual_range', '1.0', 'medium')"#,
        )
        .bind(document_version_id)
        .bind(filing_id)
        .bind(&liability.owner_type)
        .bind(&liability.creditor_name)
        .bind(&liability.liability_type)
        .bind(&liability.date_incurred)
        .bind(liability.amount.minimum)
        .bind(liability.amount.maximum)
        .bind(liability.amount.is_unbounded)
        .bind(report.reporting_period_end.or(report.filing_date))
        .bind(&liability.raw_text)
        .bind(serde_json::json!({ "range": liability.amount.raw }))
        .execute(pool)
        .await?;
    }
    for income in &report.income {
        sqlx::query(
            r#"INSERT INTO disclosure_income
               (document_version_id,filing_id,owner_type,source_description,income_type,
                amount_min,amount_max,as_of_date,raw_text,parser_name,parser_version,parse_confidence)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'house_annual_range','1.1','medium')"#,
        )
        .bind(document_version_id)
        .bind(filing_id)
        .bind(&income.owner_type)
        .bind(&income.source_description)
        .bind(&income.income_type)
        .bind(income.amount.as_ref().map(|amount| amount.minimum))
        .bind(income.amount.as_ref().and_then(|amount| amount.maximum))
        .bind(report.reporting_period_end.or(report.filing_date))
        .bind(&income.raw_text)
        .execute(pool)
        .await?;
    }
    for gift in &report.gifts {
        sqlx::query(
            r#"INSERT INTO disclosure_gifts
               (document_version_id,filing_id,owner_type,source_description,gift_type,
                value_min,value_max,event_date,raw_text,parser_name,parser_version,parse_confidence)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'house_annual_range','1.1','medium')"#,
        )
        .bind(document_version_id)
        .bind(filing_id)
        .bind(&gift.owner_type)
        .bind(&gift.source_description)
        .bind(&gift.gift_type)
        .bind(gift.value.as_ref().map(|value| value.minimum))
        .bind(gift.value.as_ref().and_then(|value| value.maximum))
        .bind(report.reporting_period_end.or(report.filing_date))
        .bind(&gift.raw_text)
        .execute(pool)
        .await?;
    }
    for position in &report.positions {
        sqlx::query(
            r#"INSERT INTO disclosure_positions
               (document_version_id,filing_id,owner_type,organization_name,position_title,
                raw_text,parser_name,parser_version,parse_confidence)
               VALUES ($1,$2,$3,$4,$5,$6,'house_annual_range','1.1','medium')"#,
        )
        .bind(document_version_id)
        .bind(filing_id)
        .bind(&position.owner_type)
        .bind(&position.organization_name)
        .bind(&position.position_title)
        .bind(&position.raw_text)
        .execute(pool)
        .await?;
    }
    Ok(())
}

fn asset_type_name(code: Option<&str>) -> &'static str {
    match code.unwrap_or_default() {
        "ST" => "public_stock",
        "OP" => "option",
        "PE" => "retirement_account",
        "RE" => "investment_real_estate",
        "GS" | "BS" => "bond",
        "IH" => "fund",
        "OT" => "other_asset",
        _ => "other_asset",
    }
}

// ── Resolution ───────────────────────────────────────────────────────────────

async fn run_resolve(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    let mut transaction = pool.begin().await?;
    let lock: bool =
        sqlx::query_scalar("SELECT pg_try_advisory_xact_lock(hashtext('intel_worker_resolution'))")
            .fetch_one(&mut *transaction)
            .await?;
    if !lock {
        transaction.rollback().await?;
        return Ok(());
    }

    // Resolve the document first so member disclosure routes and transaction
    // rows share one canonical identity. StateDst values are formatted PA05,
    // while members.current_state contains PA.
    sqlx::query(
        r#"UPDATE disclosure_documents dd
           SET bioguide_id = matched.bioguide_id,
               chamber = matched.current_chamber
           FROM source_index_entries sie
           JOIN LATERAL (
             SELECT m.bioguide_id, m.current_chamber
             FROM members m
             WHERE lower(m.last_name) = lower(sie.last_name)
               AND lower(split_part(m.first_name, ' ', 1)) =
                   lower(split_part(sie.first_name, ' ', 1))
               AND m.current_state = left(sie.state_district, 2)
             ORDER BY m.in_office DESC, m.bioguide_id
             LIMIT 1
           ) matched ON true
           WHERE dd.source = 'house_disclosures'
             AND dd.source_record_id = sie.source_document_id
             AND sie.source_name = 'house_clerk'
             AND dd.bioguide_id IS NULL"#,
    )
    .execute(&mut *transaction)
    .await?;

    sqlx::query(
        r#"UPDATE disclosure_transactions dt
           SET bioguide_id = dd.bioguide_id
           FROM disclosure_documents dd
           WHERE dt.document_id = dd.document_id
             AND dd.bioguide_id IS NOT NULL
             AND (dt.bioguide_id IS NULL OR dt.bioguide_id = '')"#,
    )
    .execute(&mut *transaction)
    .await?;

    sqlx::query(
        r#"UPDATE disclosure_filings filing
           SET bioguide_id = document.bioguide_id
           FROM disclosure_documents document
           WHERE filing.document_id = document.document_id
             AND document.bioguide_id IS NOT NULL
             AND (filing.bioguide_id IS NULL OR filing.bioguide_id = '')"#,
    )
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        r#"UPDATE disclosure_assets asset
           SET bioguide_id = filing.bioguide_id
           FROM disclosure_filings filing
           WHERE asset.filing_id = filing.filing_id
             AND filing.bioguide_id IS NOT NULL
             AND (asset.bioguide_id IS NULL OR asset.bioguide_id = '')"#,
    )
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        r#"UPDATE disclosure_liabilities liability
           SET bioguide_id = filing.bioguide_id
           FROM disclosure_filings filing
           WHERE liability.filing_id = filing.filing_id
             AND filing.bioguide_id IS NOT NULL
             AND (liability.bioguide_id IS NULL OR liability.bioguide_id = '')"#,
    )
    .execute(&mut *transaction)
    .await?;
    for table in [
        "disclosure_income",
        "disclosure_gifts",
        "disclosure_positions",
    ] {
        sqlx::query(&format!(
            r#"UPDATE {table} record
               SET bioguide_id = filing.bioguide_id
               FROM disclosure_filings filing
               WHERE record.filing_id = filing.filing_id
                 AND filing.bioguide_id IS NOT NULL
                 AND (record.bioguide_id IS NULL OR record.bioguide_id = '')"#
        ))
        .execute(&mut *transaction)
        .await?;
    }

    sqlx::query(
        r#"INSERT INTO organizations (canonical_name, organization_type)
           SELECT DISTINCT dt.asset_name, 'company'
           FROM disclosure_transactions dt
           WHERE dt.ticker IS NOT NULL AND dt.ticker != '' AND dt.asset_name != ''
           ON CONFLICT (canonical_name, organization_type)
           DO UPDATE SET updated_at = now()"#,
    )
    .execute(&mut *transaction)
    .await?;

    sqlx::query(
        r#"INSERT INTO organization_identifiers (organization_id, scheme, value, source)
           SELECT DISTINCT ON (dt.ticker)
                  o.organization_id, 'ticker', dt.ticker, 'house_disclosures'
           FROM disclosure_transactions dt
           JOIN organizations o
             ON o.canonical_name = dt.asset_name AND o.organization_type = 'company'
           WHERE dt.ticker IS NOT NULL AND dt.ticker != ''
           ORDER BY dt.ticker, dt.transaction_id DESC
           ON CONFLICT (scheme, value) DO NOTHING"#,
    )
    .execute(&mut *transaction)
    .await?;

    sqlx::query(
        r#"INSERT INTO relationship_evidence
           (subject_key, object_key, relation_type, evidence_tier, confidence,
            source, source_record_id, source_url, observed_at,
            amount_min, amount_max, details)
           SELECT 'member:' || dt.bioguide_id,
                  'organization:' || o.organization_id,
                  'disclosed_trade', 'direct', 'verified', 'house_disclosures',
                  dt.document_id::text || ':' || dt.transaction_id::text,
                  dd.source_url, dt.transaction_date,
                  dt.amount_min, dt.amount_max,
                  jsonb_build_object('ticker', dt.ticker,
                                     'transaction_type', dt.transaction_type,
                                     'owner_type', dt.owner_type)
           FROM disclosure_transactions dt
           JOIN disclosure_documents dd ON dt.document_id = dd.document_id
           JOIN organization_identifiers oi
             ON oi.scheme = 'ticker' AND oi.value = dt.ticker
           JOIN organizations o ON o.organization_id = oi.organization_id
           WHERE dt.bioguide_id IS NOT NULL
             AND dt.bioguide_id != ''
             AND dt.ticker IS NOT NULL
             AND dt.ticker != ''
           ON CONFLICT (subject_key, object_key, relation_type, source, source_record_id)
           DO UPDATE SET source_url = EXCLUDED.source_url"#,
    )
    .execute(&mut *transaction)
    .await?;

    // Keep API rows and the evidence graph on the same committed snapshot.
    sqlx::query("REFRESH MATERIALIZED VIEW stock_trades")
        .execute(&mut *transaction)
        .await?;

    build_financial_snapshots(&mut transaction).await?;

    transaction.commit().await?;
    info!("Resolution complete; stock trade view refreshed");
    Ok(())
}

#[derive(sqlx::FromRow)]
struct SnapshotFiling {
    filing_id: i64,
    document_id: i64,
    document_version_id: i64,
    bioguide_id: String,
    reporting_year: i32,
}

#[derive(sqlx::FromRow)]
struct SnapshotAsset {
    asset_id: i64,
    asset_type: Option<String>,
    value_min: f64,
    value_max: Option<f64>,
    value_is_unbounded: bool,
}

#[derive(sqlx::FromRow)]
struct SnapshotLiability {
    liability_id: i64,
    liability_type: String,
    amount_min: f64,
    amount_max: Option<f64>,
    amount_is_unbounded: bool,
}

async fn build_financial_snapshots(
    transaction: &mut Transaction<'_, Postgres>,
) -> Result<(), Box<dyn std::error::Error>> {
    let filings: Vec<SnapshotFiling> = sqlx::query_as(
        r#"SELECT filing.filing_id,
                  filing.document_id,
                  filing.document_version_id,
                  filing.bioguide_id,
                  COALESCE((filing.raw_json ->> 'reporting_year')::integer,
                           EXTRACT(YEAR FROM filing.filing_date)::integer) AS reporting_year
           FROM disclosure_filings filing
           WHERE filing.filing_type = 'annual_report'
             AND filing.document_version_id IS NOT NULL
             AND filing.bioguide_id IS NOT NULL"#,
    )
    .fetch_all(&mut **transaction)
    .await?;

    for filing in filings {
        let assets: Vec<SnapshotAsset> = sqlx::query_as(
            r#"SELECT asset_id, asset_type, value_min::double precision,
                      value_max::double precision, value_is_unbounded
               FROM disclosure_assets
               WHERE filing_id = $1"#,
        )
        .bind(filing.filing_id)
        .fetch_all(&mut **transaction)
        .await?;
        let liabilities: Vec<SnapshotLiability> = sqlx::query_as(
            r#"SELECT liability_id, liability_type, amount_min::double precision,
                      amount_max::double precision, amount_is_unbounded
               FROM disclosure_liabilities
               WHERE filing_id = $1"#,
        )
        .bind(filing.filing_id)
        .fetch_all(&mut **transaction)
        .await?;
        if assets.is_empty() && liabilities.is_empty() {
            continue;
        }
        let asset_min: f64 = assets.iter().map(|asset| asset.value_min).sum();
        let asset_max = assets.iter().try_fold(0.0, |total, asset| {
            asset.value_max.map(|value| total + value)
        });
        let liability_min: f64 = liabilities
            .iter()
            .map(|liability| liability.amount_min)
            .sum();
        let liability_max = liabilities.iter().try_fold(0.0, |total, liability| {
            liability.amount_max.map(|value| total + value)
        });
        let net_min = liability_max.map(|value| asset_min - value);
        let net_max = asset_max.map(|value| value - liability_min);
        let snapshot_id: i64 = sqlx::query_scalar(
            r#"INSERT INTO financial_snapshots
               (bioguide_id, document_id, document_version_id, reporting_year,
                asset_min, asset_max, liability_min, liability_max,
                net_worth_min, net_worth_max, upper_bound_unavailable,
                lower_bound_unavailable, personal_residence_unavailable,
                calculation_version, methodology_warnings)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                       true, 'annual-house-v1', $13)
               ON CONFLICT (document_version_id, calculation_version)
               DO UPDATE SET asset_min = EXCLUDED.asset_min,
                             asset_max = EXCLUDED.asset_max,
                             liability_min = EXCLUDED.liability_min,
                             liability_max = EXCLUDED.liability_max,
                             net_worth_min = EXCLUDED.net_worth_min,
                             net_worth_max = EXCLUDED.net_worth_max,
                             upper_bound_unavailable = EXCLUDED.upper_bound_unavailable,
                             lower_bound_unavailable = EXCLUDED.lower_bound_unavailable,
                             methodology_warnings = EXCLUDED.methodology_warnings,
                             calculated_at = now()
               RETURNING id"#,
        )
        .bind(&filing.bioguide_id)
        .bind(filing.document_id)
        .bind(filing.document_version_id)
        .bind(filing.reporting_year)
        .bind(asset_min)
        .bind(asset_max)
        .bind(liability_min)
        .bind(liability_max)
        .bind(net_min)
        .bind(net_max)
        .bind(asset_max.is_none())
        .bind(liability_max.is_none())
        .bind(serde_json::json!([
            "Personal residence values may be excluded by House disclosure rules.",
            "Reported ranges are bounds, not exact holdings or net worth.",
            "Income is excluded from year-end net worth calculation."
        ]))
        .fetch_one(&mut **transaction)
        .await?;
        sqlx::query("DELETE FROM snapshot_components WHERE snapshot_id = $1")
            .bind(snapshot_id)
            .execute(&mut **transaction)
            .await?;
        for asset in assets {
            sqlx::query(
                r#"INSERT INTO snapshot_components
                   (snapshot_id, record_family, source_record_id, component_type,
                    minimum_value, maximum_value, value_is_unbounded)
                   VALUES ($1, 'asset', $2, $3, $4, $5, $6)"#,
            )
            .bind(snapshot_id)
            .bind(asset.asset_id)
            .bind(
                asset
                    .asset_type
                    .unwrap_or_else(|| "other_asset".to_string()),
            )
            .bind(asset.value_min)
            .bind(asset.value_max)
            .bind(asset.value_is_unbounded)
            .execute(&mut **transaction)
            .await?;
        }
        for liability in liabilities {
            sqlx::query(
                r#"INSERT INTO snapshot_components
                   (snapshot_id, record_family, source_record_id, component_type,
                    minimum_value, maximum_value, value_is_unbounded)
                   VALUES ($1, 'liability', $2, $3, $4, $5, $6)"#,
            )
            .bind(snapshot_id)
            .bind(liability.liability_id)
            .bind(liability.liability_type)
            .bind(liability.amount_min)
            .bind(liability.amount_max)
            .bind(liability.amount_is_unbounded)
            .execute(&mut **transaction)
            .await?;
        }
    }
    Ok(())
}

// ── Heartbeat ────────────────────────────────────────────────────────────────

async fn retry_job(
    pool: &PgPool,
    job_id: i64,
    error_message: &str,
    fixed_delay_seconds: Option<i64>,
) -> Result<(), sqlx::Error> {
    let (attempts, max_attempts): (i32, i32) =
        sqlx::query_as("SELECT attempts, max_attempts FROM ingest_jobs WHERE id = $1")
            .bind(job_id)
            .fetch_one(pool)
            .await?;
    let delay_seconds = retry_delay_seconds(
        attempts,
        fixed_delay_seconds,
        rand::thread_rng().gen_range(0..30),
    );

    let terminal = retry_disposition(attempts, max_attempts) == RetryDisposition::Failed;
    sqlx::query(
        "UPDATE ingest_jobs
         SET attempts = attempts + 1,
             status = CASE WHEN $1 THEN 'failed'::ingest_job_status
                           ELSE 'pending'::ingest_job_status END,
             available_at = now() + $2 * interval '1 second',
             locked_by = NULL,
             locked_at = NULL,
             error_message = $3,
             finished_at = CASE WHEN $1 THEN now() ELSE NULL END
         WHERE id = $4",
    )
    .bind(terminal)
    .bind(delay_seconds)
    .bind(error_message)
    .bind(job_id)
    .execute(pool)
    .await?;
    Ok(())
}

async fn heartbeat(pool: &PgPool, instance_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    sqlx::query(
        "INSERT INTO worker_heartbeats (instance_id, last_heartbeat)
         VALUES ($1, now())
         ON CONFLICT (instance_id) DO UPDATE SET last_heartbeat = now()",
    )
    .bind(instance_id)
    .execute(pool)
    .await?;
    Ok(())
}

async fn heartbeat_loop(pool: PgPool, instance_id: String) {
    let mut interval = tokio::time::interval(Duration::from_secs(30));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        interval.tick().await;
        if let Err(error) = heartbeat(&pool, &instance_id).await {
            warn!(error = %error, "Heartbeat failed");
        }
    }
}

async fn recover_stale_jobs(pool: &PgPool) -> Result<(), sqlx::Error> {
    let stale_minutes = std::env::var("STALE_JOB_MINUTES")
        .ok()
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or(5)
        .clamp(1, 120);
    sqlx::query(
        "UPDATE ingest_jobs
         SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed'::ingest_job_status
                           ELSE 'pending'::ingest_job_status END,
             attempts = attempts + 1,
             available_at = now(),
             locked_by = NULL,
             locked_at = NULL,
             error_message = COALESCE(error_message, 'worker stopped while job was running')
         WHERE status = 'running'
           AND locked_at < now() - make_interval(mins => $1)",
    )
    .bind(stale_minutes)
    .execute(pool)
    .await?;
    Ok(())
}

async fn classify_pending_unsupported_forms(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    sqlx::query(
        r#"INSERT INTO parse_attempts
           (document_version_id, parser_name, parser_version, status,
            rows_extracted, error_message, finished_at)
           SELECT jobs.document_version_id, 'unsupported-form', '1.0', 'rejected', 0,
                  'unsupported House Clerk filing type ' || documents.report_type, now()
           FROM ingest_jobs jobs
           JOIN disclosure_documents documents
             ON documents.source='house_disclosures'
            AND documents.source_record_id=jobs.source_document_id
           WHERE jobs.job_type='parse_document' AND jobs.status='pending'
             AND documents.report_type NOT IN ('P','A','O','N','T')"#,
    )
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        r#"UPDATE disclosure_documents documents
           SET parse_status='rejected',
               parse_error='unsupported House Clerk filing type ' || documents.report_type
           FROM ingest_jobs jobs
           WHERE documents.source='house_disclosures'
             AND documents.source_record_id=jobs.source_document_id
             AND jobs.job_type='parse_document' AND jobs.status='pending'
             AND documents.report_type NOT IN ('P','A','O','N','T')"#,
    )
    .execute(&mut *transaction)
    .await?;
    let result = sqlx::query(
        r#"UPDATE ingest_jobs jobs
           SET status='completed', finished_at=now(), locked_by=NULL, locked_at=NULL,
               error_message='unsupported House Clerk filing type ' || documents.report_type
           FROM disclosure_documents documents
           WHERE documents.source='house_disclosures'
             AND documents.source_record_id=jobs.source_document_id
             AND jobs.job_type='parse_document' AND jobs.status='pending'
             AND documents.report_type NOT IN ('P','A','O','N','T')"#,
    )
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(result.rows_affected())
}

fn truncate_utf8(input: &str, max_bytes: usize) -> &str {
    let mut end = input.len().min(max_bytes);
    while end > 0 && !input.is_char_boundary(end) {
        end -= 1;
    }
    &input[..end]
}

#[cfg(test)]
mod tests {
    use super::{
        recovery_priorities, supported_house_filing_type, truncate_utf8, IndexEntry,
        RECOVER_DOWNLOAD_SQL, RECOVER_PARSE_SQL,
    };

    #[test]
    fn parses_real_house_clerk_index_shape() {
        let fields: Vec<&str> = "Hon.\tAlford\tMark\t\tP\tMO04\t2026\t3/31/2026\t20034201"
            .split('\t')
            .collect();
        let entry = IndexEntry::from_fields(&fields).expect("valid Clerk row");

        assert_eq!(entry.first, "Mark");
        assert_eq!(entry.last, "Alford");
        assert_eq!(entry.state_dst, "MO04");
        assert_eq!(entry.filing_type, "P");
        assert_eq!(entry.filing_date, "3/31/2026");
        assert_eq!(entry.doc_id, "20034201");
    }

    #[test]
    fn rejects_clerk_rows_without_document_ids() {
        let fields = vec!["", "Atwood", "John", "", "W", "", "2026", "", ""];
        assert!(IndexEntry::from_fields(&fields).is_none());
    }

    #[test]
    fn truncates_unknown_layout_text_on_utf8_boundary() {
        let text = format!("{}‘tail", "x".repeat(1_999));
        let truncated = truncate_utf8(&text, 2_000);
        assert!(truncated.len() <= 2_000);
        assert!(truncated.is_char_boundary(truncated.len()));
        assert!(truncated.starts_with(&"x".repeat(1_999)));
    }

    #[test]
    fn only_parser_supported_house_forms_enter_pdf_extraction() {
        for supported in ["P", "A", "O", "N", "T"] {
            assert!(supported_house_filing_type(supported));
        }
        for unsupported in ["B", "C", "D", "E", "G", "H", "W", "X"] {
            assert!(!supported_house_filing_type(unsupported));
        }
    }

    #[test]
    fn recovery_sweep_is_supported_form_only_and_idempotent() {
        for sql in [RECOVER_DOWNLOAD_SQL, RECOVER_PARSE_SQL] {
            assert!(sql.contains("filing_type_code IN ('A', 'O', 'N', 'T', 'P')"));
            assert!(sql.contains("NOT EXISTS"));
            assert!(sql.contains("ON CONFLICT DO NOTHING"));
        }
        assert!(RECOVER_PARSE_SQL.contains("jobs.document_version_id = versions.id"));
    }

    #[test]
    fn current_year_recovery_precedes_historical_backlog() {
        let (current_download, historical_download) = recovery_priorities("download_document");
        let (current_parse, historical_parse) = recovery_priorities("parse_document");

        assert!(current_download < historical_download);
        assert!(current_parse < historical_parse);
    }
}
