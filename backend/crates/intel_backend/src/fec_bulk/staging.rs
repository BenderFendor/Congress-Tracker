//! Restartable bounded-memory staging for large receipt archives.

use crate::fec_bulk::batches::{
    create_batch, find_restartable_batch, mark_individual_staged, mark_staged,
    reset_committee_stage, reset_partial_batch,
};
use crate::fec_bulk::is_plausible_fec_date;
use crate::fec_bulk::parse::{parse_committee_txn_line, parse_individual_line};
use crate::fec_bulk::pipeline::{CycleStats, PipelineError};
use crate::fec_bulk::stream::spawn_zip_batches;
use crate::repository::Repository;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::info;

const STREAM_BATCH_SIZE: usize = 1_000;

#[derive(Debug, Clone)]
pub struct ArchiveInput {
    pub path: PathBuf,
    pub entry_name: String,
    pub sha256: String,
}

#[derive(Debug, Clone, Copy)]
pub struct StagedCycle {
    pub import_batch: uuid::Uuid,
    pub individual_stats: CycleStats,
    pub committee_stats: CycleStats,
}

pub async fn stage_or_resume(
    repo: &Repository,
    cycle: u32,
    source_run_id: uuid::Uuid,
    individual_archive: ArchiveInput,
    committee_archive: ArchiveInput,
    committee_ids: HashSet<String>,
) -> Result<StagedCycle, PipelineError> {
    let existing = find_restartable_batch(
        repo.pool(),
        cycle as i32,
        &individual_archive.sha256,
        &committee_archive.sha256,
    )
    .await?;

    let (import_batch, mut status, mut individual_stats, mut committee_stats) =
        if let Some(batch) = existing {
            info!(
                cycle,
                import_batch = %batch.id,
                status = %batch.status,
                "Resuming FEC staged batch"
            );
            let individual_stats = batch.individual_stats();
            let committee_stats = batch.committee_stats();
            (batch.id, batch.status, individual_stats, committee_stats)
        } else {
            let id = uuid::Uuid::new_v4();
            create_batch(
                repo.pool(),
                id,
                cycle as i32,
                &individual_archive.sha256,
                &committee_archive.sha256,
                source_run_id,
            )
            .await?;
            (
                id,
                "staging".to_string(),
                CycleStats::default(),
                CycleStats::default(),
            )
        };

    if status == "staging" {
        reset_partial_batch(repo.pool(), import_batch).await?;
        individual_stats = ingest_individuals(
            repo,
            cycle,
            import_batch,
            &individual_archive,
            Arc::new(committee_ids.clone()),
        )
        .await?;
        mark_individual_staged(repo.pool(), import_batch, individual_stats).await?;
        status = "individual_staged".to_string();
    }

    if status == "individual_staged" {
        reset_committee_stage(repo.pool(), import_batch).await?;
        committee_stats = ingest_committee_transactions(
            repo,
            cycle,
            import_batch,
            &committee_archive,
            Arc::new(committee_ids),
        )
        .await?;
        mark_staged(repo.pool(), import_batch, committee_stats).await?;
    }

    Ok(StagedCycle {
        import_batch,
        individual_stats,
        committee_stats,
    })
}

async fn ingest_individuals(
    repo: &Repository,
    cycle: u32,
    import_batch: uuid::Uuid,
    archive: &ArchiveInput,
    committee_ids: Arc<HashSet<String>>,
) -> Result<CycleStats, PipelineError> {
    let included = move |row: &crate::fec_bulk::parse::RawIndividualReceipt| {
        committee_ids.contains(&row.committee_id)
    };
    let mut receiver = spawn_zip_batches(
        archive.path.clone(),
        vec![archive.entry_name.clone()],
        STREAM_BATCH_SIZE,
        false,
        parse_individual_line,
        included,
    );
    let mut stats = CycleStats::default();
    while let Some(batch) = receiver.recv().await {
        let batch = batch?;
        stats.rows_seen += batch.seen as i64;
        stats.rows_skipped += batch.skipped as i64;
        let mut rows = batch.rows;
        for row in &mut rows {
            if row
                .transaction_date
                .is_some_and(|date| !is_plausible_fec_date(date, cycle))
            {
                row.transaction_date = None;
            }
        }
        if !rows.is_empty() {
            stats.rows_written += repo
                .insert_staging_individuals_batch(&rows, import_batch, cycle as i32)
                .await?;
        }
    }
    Ok(stats)
}

async fn ingest_committee_transactions(
    repo: &Repository,
    cycle: u32,
    import_batch: uuid::Uuid,
    archive: &ArchiveInput,
    committee_ids: Arc<HashSet<String>>,
) -> Result<CycleStats, PipelineError> {
    let included = move |row: &crate::fec_bulk::parse::RawCommitteeTxn| {
        committee_ids.contains(&row.committee_id)
    };
    let mut receiver = spawn_zip_batches(
        archive.path.clone(),
        vec![archive.entry_name.clone()],
        STREAM_BATCH_SIZE,
        false,
        parse_committee_txn_line,
        included,
    );
    let mut stats = CycleStats::default();
    while let Some(batch) = receiver.recv().await {
        let batch = batch?;
        stats.rows_seen += batch.seen as i64;
        stats.rows_skipped += batch.skipped as i64;
        let mut rows = batch.rows;
        for row in &mut rows {
            if row
                .transaction_date
                .is_some_and(|date| !is_plausible_fec_date(date, cycle))
            {
                row.transaction_date = None;
            }
        }
        if !rows.is_empty() {
            stats.rows_written += repo
                .insert_staging_committee_txns_batch(&rows, import_batch, cycle as i32)
                .await?;
        }
    }
    Ok(stats)
}
