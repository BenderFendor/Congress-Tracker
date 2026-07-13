//! Restartable FEC bulk-cycle orchestration.

use crate::fec_bulk::download::{download_content_addressed, probe_archive, RemoteArchive};
use crate::fec_bulk::parse::{
    extract_zip_entry_from_path, parse_candidate_master, parse_ccl, parse_committee_master,
};
use crate::fec_bulk::staging::{stage_or_resume, ArchiveInput};
use crate::fec_bulk::{self, BulkFile, CycleFiles};
use crate::repository::fec::{
    FecBulkImportRecord, FecBulkImportUpsert, FecCandidateUpsert, FecCommitteeUpsert,
};
use crate::repository::Repository;
use std::collections::HashSet;
use std::path::PathBuf;
use tracing::info;

#[derive(Debug, Default, Clone, Copy)]
pub struct CycleStats {
    pub rows_seen: i64,
    pub rows_written: i64,
    pub rows_skipped: i64,
}

#[derive(Debug, Clone)]
struct LocalArchive {
    file: BulkFile,
    path: PathBuf,
    sha256: String,
    previous_status: String,
    reused: bool,
}

pub async fn run_cycle(
    repo: &Repository,
    cycle: u32,
    force: bool,
    reparse: bool,
    source_run_id: uuid::Uuid,
) -> Result<CycleStats, PipelineError> {
    if !fec_bulk::valid_cycle(cycle) {
        return Err(PipelineError::InvalidCycle(cycle));
    }

    let mut lock_connection = repo.pool().acquire().await?;
    let lock_key = 91_000_000_i64 + i64::from(cycle);
    let locked: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
        .bind(lock_key)
        .fetch_one(&mut *lock_connection)
        .await?;
    if !locked {
        return Err(PipelineError::AlreadyRunning(cycle));
    }

    let storage = fec_bulk::storage_dir();
    tokio::fs::create_dir_all(&storage)
        .await
        .map_err(|source| PipelineError::Io {
            context: format!("creating {}", storage.display()),
            source,
        })?;
    let cycle_files = CycleFiles::new(cycle);
    let mut archives = Vec::with_capacity(cycle_files.files.len());
    for file in cycle_files.files {
        archives.push(prepare_archive(repo, &storage, cycle, file, force, source_run_id).await?);
    }

    let base_current = !force
        && !reparse
        && archives
            .iter()
            .all(|archive| archive.reused && archive.previous_status == "canonicalized");
    let mut stats = if base_current {
        info!(
            cycle,
            "FEC archives unchanged; canonical cycle already current"
        );
        CycleStats::default()
    } else {
        ingest_base_archives(repo, cycle, source_run_id, &archives).await?
    };
    let supplemental = crate::fec_bulk::supplemental_ingest::ingest_supplemental_sources(
        repo,
        cycle,
        source_run_id,
        &storage,
    )
    .await?;
    add_stats(&mut stats, supplemental);
    Ok(stats)
}

pub async fn run_disbursements(
    repo: &Repository,
    cycle: u32,
    force: bool,
    source_run_id: uuid::Uuid,
) -> Result<CycleStats, PipelineError> {
    if !fec_bulk::valid_cycle(cycle) {
        return Err(PipelineError::InvalidCycle(cycle));
    }
    let mut lock_connection = repo.pool().acquire().await?;
    let lock_key = 91_000_000_i64 + i64::from(cycle);
    let locked: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
        .bind(lock_key)
        .fetch_one(&mut *lock_connection)
        .await?;
    if !locked {
        return Err(PipelineError::AlreadyRunning(cycle));
    }
    let storage = fec_bulk::storage_dir();
    tokio::fs::create_dir_all(&storage)
        .await
        .map_err(|source| PipelineError::Io {
            context: format!("creating {}", storage.display()),
            source,
        })?;
    let suffix = cycle % 100;
    let file = BulkFile {
        dataset_name: format!("oppexp{suffix}"),
        label: "Operating expenditures",
        url_path: format!("{cycle}/oppexp{suffix}.zip"),
        entry_name: "oppexp.txt",
    };
    let archive = prepare_archive(repo, &storage, cycle, file, force, source_run_id).await?;
    let stats = crate::fec_bulk::disbursements::ingest(
        repo,
        cycle,
        source_run_id,
        archive.path,
        archive.file.entry_name.to_string(),
        archive.sha256.clone(),
    )
    .await?;
    repo.update_bulk_import_status(
        &archive.file.dataset_name,
        &archive.sha256,
        "canonicalized",
        stats.rows_seen,
        None,
    )
    .await?;
    Ok(stats)
}

async fn ingest_base_archives(
    repo: &Repository,
    cycle: u32,
    source_run_id: uuid::Uuid,
    archives: &[LocalArchive],
) -> Result<CycleStats, PipelineError> {
    let mut stats = ingest_identity_files(repo, cycle, source_run_id, archives).await?;
    let committee_ids = repo.congressional_committee_ids(cycle as i32).await?;
    if committee_ids.is_empty() {
        return Err(PipelineError::NoCongressionalCommittees(cycle));
    }
    info!(
        cycle,
        committees = committee_ids.len(),
        "Streaming receipts for congressional committees"
    );

    let individual_archive = archive(archives, &format!("indiv{}", cycle % 100))?;
    let committee_archive = archive(archives, &format!("oth{}", cycle % 100))?;
    let staged = stage_or_resume(
        repo,
        cycle,
        source_run_id,
        ArchiveInput {
            path: individual_archive.path.clone(),
            entry_name: individual_archive.file.entry_name.to_string(),
            sha256: individual_archive.sha256.clone(),
        },
        ArchiveInput {
            path: committee_archive.path.clone(),
            entry_name: committee_archive.file.entry_name.to_string(),
            sha256: committee_archive.sha256.clone(),
        },
        committee_ids,
    )
    .await?;
    add_stats(&mut stats, staged.individual_stats);
    add_stats(&mut stats, staged.committee_stats);
    repo.update_bulk_import_status(
        &individual_archive.file.dataset_name,
        &individual_archive.sha256,
        "parsed",
        staged.individual_stats.rows_seen,
        None,
    )
    .await?;

    repo.update_bulk_import_status(
        &committee_archive.file.dataset_name,
        &committee_archive.sha256,
        "parsed",
        staged.committee_stats.rows_seen,
        None,
    )
    .await?;

    let disbursement_archive = archive(archives, &format!("oppexp{}", cycle % 100))?;
    let disbursement_stats = crate::fec_bulk::disbursements::ingest(
        repo,
        cycle,
        source_run_id,
        disbursement_archive.path.clone(),
        disbursement_archive.file.entry_name.to_string(),
        disbursement_archive.sha256.clone(),
    )
    .await?;
    add_stats(&mut stats, disbursement_stats);

    if let Err(error) = repo
        .run_bulk_canonicalize_and_rank(cycle as i32, staged.import_batch, source_run_id)
        .await
    {
        crate::fec_bulk::batches::record_retryable_error(
            repo.pool(),
            staged.import_batch,
            &error.to_string(),
        )
        .await?;
        return Err(error.into());
    }
    crate::fec_bulk::batches::mark_canonicalized(repo.pool(), staged.import_batch).await?;
    sqlx::query(
        r#"INSERT INTO fec_receipt_cycle_counts (election_cycle, individual_count, committee_count)
           SELECT $1,
                  (SELECT COUNT(*) FROM fec_canonical_individual_receipts WHERE election_cycle = $1),
                  (SELECT COUNT(*) FROM fec_canonical_committee_receipts WHERE election_cycle = $1)
           ON CONFLICT (election_cycle) DO UPDATE
           SET individual_count = EXCLUDED.individual_count,
               committee_count = EXCLUDED.committee_count,
               refreshed_at = now()"#,
    )
    .bind(cycle as i32)
    .execute(repo.pool())
    .await?;
    for archive in archives {
        repo.update_bulk_import_status(
            &archive.file.dataset_name,
            &archive.sha256,
            "canonicalized",
            0,
            None,
        )
        .await?;
    }
    sqlx::query("SELECT refresh_fec_campaign_finance_summary($1)")
        .bind(cycle as i32)
        .execute(repo.pool())
        .await?;
    Ok(stats)
}

async fn prepare_archive(
    repo: &Repository,
    storage: &std::path::Path,
    cycle: u32,
    file: BulkFile,
    force: bool,
    source_run_id: uuid::Uuid,
) -> Result<LocalArchive, PipelineError> {
    let url = format!("{}/{}", CycleFiles::base_url(), file.url_path);
    let remote = probe_archive(&url).await?;
    let latest = repo.latest_bulk_import(&file.dataset_name).await?;
    if !force {
        if let Some(existing) = latest.as_ref().filter(|record| reusable(record, &remote)) {
            let path = PathBuf::from(existing.archive_path.as_deref().unwrap_or_default());
            repo.touch_bulk_import(&file.dataset_name, &existing.sha256, source_run_id)
                .await?;
            return Ok(LocalArchive {
                file,
                path,
                sha256: existing.sha256.clone(),
                previous_status: existing.status.clone(),
                reused: true,
            });
        }
    }

    let downloaded =
        download_content_addressed(&url, storage, cycle, &file.dataset_name, &remote).await?;
    let archive_path = downloaded.path.to_string_lossy();
    repo.upsert_bulk_import(FecBulkImportUpsert {
        dataset_name: &file.dataset_name,
        election_cycle: cycle as i32,
        source_url: &url,
        sha256: &downloaded.sha256,
        compressed_bytes: downloaded.compressed_bytes as i64,
        source_modified_at: remote.last_modified,
        etag: remote.etag.as_deref(),
        archive_path: &archive_path,
        source_run_id,
    })
    .await?;
    Ok(LocalArchive {
        file,
        path: downloaded.path,
        sha256: downloaded.sha256,
        previous_status: "downloaded".to_string(),
        reused: false,
    })
}

fn reusable(record: &FecBulkImportRecord, remote: &RemoteArchive) -> bool {
    let Some(path) = record.archive_path.as_deref() else {
        return false;
    };
    if !std::path::Path::new(path).is_file() {
        return false;
    }
    let same_etag = record.etag.is_some() && record.etag == remote.etag;
    let same_modified = record.source_modified_at.is_some()
        && record.source_modified_at == remote.last_modified
        && record
            .compressed_bytes
            .and_then(|value| u64::try_from(value).ok())
            == remote.content_length;
    same_etag || same_modified
}

async fn ingest_identity_files(
    repo: &Repository,
    cycle: u32,
    source_run_id: uuid::Uuid,
    archives: &[LocalArchive],
) -> Result<CycleStats, PipelineError> {
    let mut stats = CycleStats::default();
    let candidate_archive = archive(archives, &format!("cn{}", cycle % 100))?;
    let candidate_text = extract_zip_entry_from_path(
        &candidate_archive.path,
        &[candidate_archive.file.entry_name],
    )?;
    let (candidates, candidate_skipped) = parse_candidate_master(&candidate_text);
    for candidate in candidates
        .iter()
        .filter(|candidate| matches!(candidate.office.as_deref(), Some("H" | "S")))
    {
        repo.upsert_fec_candidate(FecCandidateUpsert {
            candidate_id: &candidate.candidate_id,
            bioguide_id: None,
            name: &candidate.name,
            party: candidate.party.as_deref(),
            state: candidate.office_state.as_deref(),
            district: candidate.district.as_deref(),
            office: candidate.office.as_deref(),
            incumbent_challenge: candidate.incumbent_challenge.as_deref(),
            principal_committee_id: candidate.principal_committee_id.as_deref(),
            active_through: candidate.election_year,
            first_file_date: None,
            last_file_date: None,
            source_run_id: Some(source_run_id),
        })
        .await?;
        stats.rows_written += 1;
    }
    stats.rows_seen += candidates.len() as i64 + candidate_skipped as i64;
    stats.rows_skipped += candidate_skipped as i64;

    let committee_archive = archive(archives, &format!("cm{}", cycle % 100))?;
    let committee_text = extract_zip_entry_from_path(
        &committee_archive.path,
        &[committee_archive.file.entry_name],
    )?;
    let (committees, committee_skipped) = parse_committee_master(&committee_text);
    for committee in &committees {
        repo.upsert_fec_committee(FecCommitteeUpsert {
            committee_id: &committee.committee_id,
            name: committee.name.as_deref().unwrap_or(&committee.committee_id),
            committee_type: committee.committee_type.as_deref(),
            committee_type_full: None,
            designation: committee.designation.as_deref(),
            designation_full: None,
            party: committee.party.as_deref(),
            state: committee.state.as_deref(),
            treasurer_name: committee.treasurer_name.as_deref(),
            affiliated_committee_name: committee.connected_org.as_deref(),
            sponsor_candidate_ids: committee
                .candidate_id
                .as_ref()
                .map_or_else(|| serde_json::json!([]), |id| serde_json::json!([id])),
            source_run_id: Some(source_run_id),
        })
        .await?;
        stats.rows_written += 1;
    }
    stats.rows_seen += committees.len() as i64 + committee_skipped as i64;
    stats.rows_skipped += committee_skipped as i64;

    let candidate_ids: HashSet<String> = candidates
        .iter()
        .filter(|candidate| matches!(candidate.office.as_deref(), Some("H" | "S")))
        .map(|candidate| candidate.candidate_id.clone())
        .collect();
    let committee_ids: HashSet<String> = committees
        .iter()
        .map(|committee| committee.committee_id.clone())
        .collect();
    let linkage_archive = archive(archives, &format!("ccl{}", cycle % 100))?;
    let linkage_text =
        extract_zip_entry_from_path(&linkage_archive.path, &[linkage_archive.file.entry_name])?;
    let (linkages, linkage_skipped) = parse_ccl(&linkage_text);
    for linkage in linkages
        .iter()
        .filter(|linkage| linkage.election_cycle() == Some(cycle as i32))
        .filter(|linkage| {
            linkage.candidate_id.starts_with('H') || linkage.candidate_id.starts_with('S')
        })
    {
        let issue_type = if !candidate_ids.contains(&linkage.candidate_id) {
            Some("candidate_missing")
        } else if !committee_ids.contains(&linkage.committee_id) {
            Some("committee_missing")
        } else {
            None
        };
        if let Some(issue_type) = issue_type {
            repo.record_fec_linkage_issue(
                cycle as i32,
                &linkage.candidate_id,
                &linkage.committee_id,
                issue_type,
                source_run_id,
            )
            .await?;
            stats.rows_skipped += 1;
            continue;
        }
        repo.upsert_candidate_committee(linkage).await?;
        repo.resolve_fec_linkage_issues(cycle as i32, &linkage.candidate_id, &linkage.committee_id)
            .await?;
        stats.rows_written += 1;
    }
    stats.rows_seen += linkages.len() as i64 + linkage_skipped as i64;
    stats.rows_skipped += linkage_skipped as i64;
    stats.rows_written +=
        crate::fec_bulk::identity::resolve_candidate_members(repo.pool(), source_run_id).await?;
    stats.rows_written += crate::fec_bulk::identity::add_principal_committee_links(
        repo.pool(),
        cycle as i32,
        source_run_id,
    )
    .await?;
    Ok(stats)
}

/// Reparse the current small identity archives without touching transaction
/// staging. Useful after identity-resolution code changes and for focused
/// repair jobs.
pub async fn refresh_identities_from_current_archives(
    repo: &Repository,
    cycle: u32,
    source_run_id: uuid::Uuid,
) -> Result<CycleStats, PipelineError> {
    if !fec_bulk::valid_cycle(cycle) {
        return Err(PipelineError::InvalidCycle(cycle));
    }
    let mut lock_connection = repo.pool().acquire().await?;
    let lock_key = 91_000_000_i64 + i64::from(cycle);
    let locked: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
        .bind(lock_key)
        .fetch_one(&mut *lock_connection)
        .await?;
    if !locked {
        return Err(PipelineError::AlreadyRunning(cycle));
    }

    let mut archives = Vec::new();
    for file in CycleFiles::new(cycle).files.into_iter().take(3) {
        let record = repo
            .latest_bulk_import(&file.dataset_name)
            .await?
            .ok_or_else(|| PipelineError::MissingArchive(file.dataset_name.clone()))?;
        let path = PathBuf::from(record.archive_path.as_deref().unwrap_or_default());
        if !path.is_file() {
            return Err(PipelineError::MissingArchive(file.dataset_name));
        }
        archives.push(LocalArchive {
            file,
            path,
            sha256: record.sha256,
            previous_status: record.status,
            reused: true,
        });
    }
    ingest_identity_files(repo, cycle, source_run_id, &archives).await
}

fn archive<'a>(
    archives: &'a [LocalArchive],
    dataset_name: &str,
) -> Result<&'a LocalArchive, PipelineError> {
    archives
        .iter()
        .find(|archive| archive.file.dataset_name == dataset_name)
        .ok_or_else(|| PipelineError::MissingArchive(dataset_name.to_string()))
}

fn add_stats(total: &mut CycleStats, value: CycleStats) {
    total.rows_seen += value.rows_seen;
    total.rows_written += value.rows_written;
    total.rows_skipped += value.rows_skipped;
}

#[derive(Debug, thiserror::Error)]
pub enum PipelineError {
    #[error("invalid FEC election cycle {0}")]
    InvalidCycle(u32),
    #[error("no House or Senate candidate committees resolved for cycle {0}")]
    NoCongressionalCommittees(u32),
    #[error("FEC bulk ingest for cycle {0} is already running")]
    AlreadyRunning(u32),
    #[error("missing prepared FEC archive {0}")]
    MissingArchive(String),
    #[error(transparent)]
    Download(#[from] crate::fec_bulk::download::DownloadError),
    #[error(transparent)]
    Parse(#[from] crate::fec_bulk::parse::ParseError),
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error("I/O error {context}: {source}")]
    Io {
        context: String,
        #[source]
        source: std::io::Error,
    },
}
