use chrono::Datelike;
use clap::Parser;
use rand::Rng;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use tokio::process::Command as TokioCommand;
use tracing::{info, warn};

pub mod parsers;

#[derive(Parser)]
#[command(name = "intel_worker")]
struct Cli {
    #[arg(long, default_value_t = false)]
    backfill: bool,
}

fn storage_dir() -> PathBuf {
    let base =
        std::env::var("WORKER_STORAGE_DIR").unwrap_or_else(|_| "./worker_storage".to_string());
    PathBuf::from(base)
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

    let pool = PgPool::connect(&database_url)
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

    info!(instance_id, "Worker started");

    let mut discovery_tick = tokio::time::interval(Duration::from_secs(1800));
    let mut download_tick = tokio::time::interval(Duration::from_secs(10));
    let mut parse_tick = tokio::time::interval(Duration::from_secs(10));
    let mut resolve_tick = tokio::time::interval(Duration::from_secs(60));
    let mut heartbeat_tick = tokio::time::interval(Duration::from_secs(30));
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

    loop {
        tokio::select! {
            _ = discovery_tick.tick() => {
                if let Err(e) = run_discovery(&pool, cli.backfill).await {
                    warn!(error = %e, "Discovery step failed");
                }
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
            _ = heartbeat_tick.tick() => {
                if let Err(e) = heartbeat(&pool, &instance_id).await {
                    warn!(error = %e, "Heartbeat failed");
                }
            }
            _ = profile_refresh_tick.tick() => {
                let refresh_pool = pool.clone();
                tokio::spawn(async move {
                    if let Err(e) = run_profile_evidence_refresh(&refresh_pool).await {
                        warn!(error = %e, "All-member profile evidence refresh failed");
                    }
                });
            }
            _ = fec_bulk_tick.tick() => {
                let refresh_pool = pool.clone();
                tokio::spawn(async move {
                    if let Err(e) = run_fec_bulk_refresh(&refresh_pool).await {
                        warn!(error = %e, "FEC bulk refresh failed");
                    }
                });
            }
        }
    }
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
/// Runs the `ingest fec-bulk` CLI command for the current cycle.
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
    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());
    let current_cycle = {
        let year = chrono::Utc::now().year();
        if year % 2 == 0 { year } else { year - 1 }
    };
    let mut command = TokioCommand::new(&cargo);
    command
        .args([
            "run",
            "-p",
            "intel_backend",
            "--bin",
            "ingest",
            "--",
            "fec-bulk",
            "--cycles",
            &current_cycle.to_string(),
        ])
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
// ── Discovery ────────────────────────────────────────────────────────────────

/// Advisory lock key helper — deterministic hash of a string.
fn lock_key(s: &str) -> i64 {
    s.as_bytes()
        .iter()
        .fold(0i64, |a, &b| a.wrapping_mul(31).wrapping_add(b as i64))
}

/// Download the House Clerk yearly index ZIP, parse its tab-separated index,
/// and enqueue supported documents that have not been seen before.
async fn run_discovery(pool: &PgPool, backfill: bool) -> Result<(), Box<dyn std::error::Error>> {
    let current_year = chrono::Utc::now().year();
    // When backfilling, start from 2012; otherwise just the current year.
    let years: Vec<i32> = if backfill {
        (2012..=current_year).rev().collect()
    } else {
        vec![current_year]
    };

    for year in years {
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

async fn discover_year(
    pool: &PgPool,
    year: i32,
) -> Result<(usize, usize), Box<dyn std::error::Error>> {
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

    // The automated parser currently supports periodic transaction reports.
    // Keep every index row for coverage, but do not enqueue unsupported forms
    // and then misrepresent zero parsed rows as a successful ingest.
    if entry.filing_type == "P" {
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
    }

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
    let jobs: Vec<(i64, i32, String)> = sqlx::query_as(
        "WITH picked AS (
           SELECT id FROM ingest_jobs
           WHERE job_type = 'download_document'
             AND status = 'pending'
             AND attempts < max_attempts
             AND available_at <= now()
           ORDER BY priority, created_at
           LIMIT 5
           FOR UPDATE SKIP LOCKED
         )
         UPDATE ingest_jobs AS jobs
         SET status = 'running', locked_by = $1, locked_at = now()
         FROM picked
         WHERE jobs.id = picked.id
         RETURNING jobs.id, jobs.source_year, jobs.source_document_id",
    )
    .bind(instance_id)
    .fetch_all(pool)
    .await?;

    let client = http_client();

    for (job_id, year, doc_id) in jobs {
        match download_one(&client, pool, job_id, year, &doc_id).await {
            Ok(()) => {}
            Err(e) => {
                warn!(job_id, error = %e, "Download failed");
                retry_job(pool, job_id, &e.to_string(), None).await?;
            }
        }
    }
    Ok(())
}

async fn download_one(
    client: &reqwest::Client,
    pool: &PgPool,
    job_id: i64,
    year: i32,
    doc_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
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

    if status == reqwest::StatusCode::NOT_MODIFIED {
        sqlx::query("UPDATE ingest_jobs SET status = 'skipped', finished_at = now() WHERE id = $1")
            .bind(job_id)
            .execute(pool)
            .await?;
        return Ok(());
    }

    if status == reqwest::StatusCode::TOO_MANY_REQUESTS
        || status == reqwest::StatusCode::SERVICE_UNAVAILABLE
    {
        return Err(format!("HTTP {}: rate limited", status.as_u16()).into());
    }

    if !status.is_success() {
        return Err(format!("HTTP {} for {}", status.as_u16(), pdf_url).into());
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
    let jobs: Vec<(i64, i32, String, i64)> = sqlx::query_as(
        "WITH picked AS (
           SELECT id FROM ingest_jobs
           WHERE job_type = 'parse_document'
             AND status = 'pending'
             AND attempts < max_attempts
             AND available_at <= now()
           ORDER BY priority, created_at
           LIMIT 5
           FOR UPDATE SKIP LOCKED
         )
         UPDATE ingest_jobs AS jobs
         SET status = 'running', locked_by = $1, locked_at = now()
         FROM picked
         WHERE jobs.id = picked.id
         RETURNING jobs.id, jobs.source_year, jobs.source_document_id,
                   jobs.document_version_id",
    )
    .bind(instance_id)
    .fetch_all(pool)
    .await?;

    for (job_id, _year, doc_id, version_id) in jobs {
        match parse_one(pool, job_id, &doc_id, version_id).await {
            Ok(()) => {}
            Err(e) => {
                warn!(job_id, doc_id, error = %e, "Parse failed");
                retry_job(pool, job_id, &e.to_string(), Some(3600)).await?;
            }
        }
    }
    Ok(())
}

async fn parse_one(
    pool: &PgPool,
    job_id: i64,
    doc_id: &str,
    version_id: i64,
) -> Result<(), Box<dyn std::error::Error>> {
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

    // Extract text
    let text = parsers::extract_text(&pdf_path)?;
    let fingerprinted_layout = parsers::fingerprint(&text);
    // The Clerk index is the authoritative document classification. Current
    // PTR PDFs use embedded fonts that can collapse their title to initials in
    // pdftotext output, so a valid P filing must not depend on title OCR.
    let layout = if report_type == "P" && fingerprinted_layout == parsers::DocumentLayout::Unknown {
        parsers::DocumentLayout::PtrElectronic2022Plus
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

    // Run the parser inside catch_unwind so panics don't kill the worker
    let parse_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        match layout {
            parsers::DocumentLayout::PtrElectronic2022Plus
            | parsers::DocumentLayout::PtrPre2015 => parsers::parse_ptr_text(&text),
            parsers::DocumentLayout::PtrLegacy2015To2021 => parsers::parse_ptr_legacy(&text),
            parsers::DocumentLayout::AnnualElectronic => parsers::parse_annual_electronic(&text),
            _ => {
                Vec::new() // unknown layout — nothing extracted
            }
        }
    }));

    let transactions = match parse_result {
        Ok(txs) => txs,
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

    let rows_extracted = transactions.len() as i32;

    if rows_extracted == 0 && layout == parsers::DocumentLayout::Unknown {
        // Record unknown layout
        sqlx::query(
            "INSERT INTO parse_issues (parse_attempt_id, raw_text, issue_type, issue_detail)
             VALUES ($1, $2, 'unknown_layout', $3)",
        )
        .bind(attempt_id)
        .bind(&text[..text.len().min(2000)])
        .bind(format!("{:?}", layout))
        .execute(pool)
        .await?;
    }

    // Insert parsed transactions with idempotent conflict handling
    for tx in &transactions {
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
        .execute(pool)
        .await?;
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

    transaction.commit().await?;
    info!("Resolution complete; stock trade view refreshed");
    Ok(())
}

// ── Heartbeat ────────────────────────────────────────────────────────────────

async fn retry_job(
    pool: &PgPool,
    job_id: i64,
    error_message: &str,
    fixed_delay_seconds: Option<i64>,
) -> Result<(), sqlx::Error> {
    let attempts: i32 = sqlx::query_scalar("SELECT attempts FROM ingest_jobs WHERE id = $1")
        .bind(job_id)
        .fetch_one(pool)
        .await?;
    let delay_seconds = fixed_delay_seconds.unwrap_or_else(|| {
        let exponent = u32::try_from(attempts.clamp(0, 10)).unwrap_or(0);
        i64::try_from(2u64.pow(exponent) + rand::thread_rng().gen_range(0..30)).unwrap_or(60)
    });

    sqlx::query(
        "UPDATE ingest_jobs
         SET attempts = attempts + 1,
             status = CASE WHEN attempts + 1 >= max_attempts
                           THEN 'failed'::ingest_job_status
                           ELSE 'pending'::ingest_job_status END,
             available_at = now() + $1 * interval '1 second',
             locked_by = NULL,
             locked_at = NULL,
             error_message = $2,
             finished_at = CASE WHEN attempts + 1 >= max_attempts THEN now() ELSE NULL END
         WHERE id = $3",
    )
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

async fn recover_stale_jobs(pool: &PgPool) -> Result<(), sqlx::Error> {
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
           AND locked_at < now() - interval '15 minutes'",
    )
    .execute(pool)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::IndexEntry;

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
}
