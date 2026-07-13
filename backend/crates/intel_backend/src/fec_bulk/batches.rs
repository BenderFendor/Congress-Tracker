//! Durable checkpoints for restarting large FEC staging runs.

use crate::fec_bulk::pipeline::CycleStats;
use sqlx::PgPool;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RestartableBatch {
    pub id: uuid::Uuid,
    pub status: String,
    pub individual_rows_seen: i64,
    pub individual_rows_written: i64,
    pub individual_rows_skipped: i64,
    pub committee_rows_seen: i64,
    pub committee_rows_written: i64,
    pub committee_rows_skipped: i64,
}

impl RestartableBatch {
    pub fn individual_stats(&self) -> CycleStats {
        CycleStats {
            rows_seen: self.individual_rows_seen,
            rows_written: self.individual_rows_written,
            rows_skipped: self.individual_rows_skipped,
        }
    }

    pub fn committee_stats(&self) -> CycleStats {
        CycleStats {
            rows_seen: self.committee_rows_seen,
            rows_written: self.committee_rows_written,
            rows_skipped: self.committee_rows_skipped,
        }
    }
}

pub async fn find_restartable_batch(
    pool: &PgPool,
    election_cycle: i32,
    individual_sha256: &str,
    committee_sha256: &str,
) -> Result<Option<RestartableBatch>, sqlx::Error> {
    sqlx::query_as(
        r#"SELECT id, status,
                  individual_rows_seen, individual_rows_written, individual_rows_skipped,
                  committee_rows_seen, committee_rows_written, committee_rows_skipped
           FROM fec_bulk_batches batch
           WHERE election_cycle = $1
             AND individual_sha256 = $2
             AND committee_sha256 = $3
             AND (
                 status = 'staging'
                 OR (status = 'individual_staged' AND EXISTS (
                     SELECT 1 FROM fec_staging_individuals WHERE import_batch = batch.id
                 ))
                 OR (status = 'staged' AND EXISTS (
                     SELECT 1 FROM fec_staging_individuals WHERE import_batch = batch.id
                 ) AND EXISTS (
                     SELECT 1 FROM fec_staging_committee_txns WHERE import_batch = batch.id
                 ))
             )
           ORDER BY created_at DESC
           LIMIT 1"#,
    )
    .bind(election_cycle)
    .bind(individual_sha256)
    .bind(committee_sha256)
    .fetch_optional(pool)
    .await
}

pub async fn create_batch(
    pool: &PgPool,
    id: uuid::Uuid,
    election_cycle: i32,
    individual_sha256: &str,
    committee_sha256: &str,
    source_run_id: uuid::Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO fec_bulk_batches
           (id, election_cycle, individual_sha256, committee_sha256, source_run_id, status)
           VALUES ($1, $2, $3, $4, $5, 'staging')"#,
    )
    .bind(id)
    .bind(election_cycle)
    .bind(individual_sha256)
    .bind(committee_sha256)
    .bind(source_run_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn reset_partial_batch(pool: &PgPool, id: uuid::Uuid) -> Result<(), sqlx::Error> {
    let mut transaction = pool.begin().await?;
    sqlx::query("DELETE FROM fec_staging_individuals WHERE import_batch = $1")
        .bind(id)
        .execute(&mut *transaction)
        .await?;
    sqlx::query("DELETE FROM fec_staging_committee_txns WHERE import_batch = $1")
        .bind(id)
        .execute(&mut *transaction)
        .await?;
    sqlx::query(
        r#"UPDATE fec_bulk_batches
           SET status = 'staging',
               individual_rows_seen = 0,
               individual_rows_written = 0,
               individual_rows_skipped = 0,
               committee_rows_seen = 0,
               committee_rows_written = 0,
               committee_rows_skipped = 0,
               error_message = NULL,
               staged_at = NULL
           WHERE id = $1"#,
    )
    .bind(id)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await
}

pub async fn reset_committee_stage(pool: &PgPool, id: uuid::Uuid) -> Result<(), sqlx::Error> {
    let mut transaction = pool.begin().await?;
    sqlx::query("DELETE FROM fec_staging_committee_txns WHERE import_batch = $1")
        .bind(id)
        .execute(&mut *transaction)
        .await?;
    sqlx::query(
        r#"UPDATE fec_bulk_batches
           SET committee_rows_seen = 0,
               committee_rows_written = 0,
               committee_rows_skipped = 0,
               error_message = NULL,
               staged_at = NULL
           WHERE id = $1"#,
    )
    .bind(id)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await
}

pub async fn mark_individual_staged(
    pool: &PgPool,
    id: uuid::Uuid,
    stats: CycleStats,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"UPDATE fec_bulk_batches
           SET status = 'individual_staged',
               individual_rows_seen = $2,
               individual_rows_written = $3,
               individual_rows_skipped = $4,
               error_message = NULL
           WHERE id = $1"#,
    )
    .bind(id)
    .bind(stats.rows_seen)
    .bind(stats.rows_written)
    .bind(stats.rows_skipped)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_staged(
    pool: &PgPool,
    id: uuid::Uuid,
    stats: CycleStats,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"UPDATE fec_bulk_batches
           SET status = 'staged',
               committee_rows_seen = $2,
               committee_rows_written = $3,
               committee_rows_skipped = $4,
               error_message = NULL,
               staged_at = now()
           WHERE id = $1"#,
    )
    .bind(id)
    .bind(stats.rows_seen)
    .bind(stats.rows_written)
    .bind(stats.rows_skipped)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn record_retryable_error(
    pool: &PgPool,
    id: uuid::Uuid,
    error: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE fec_bulk_batches SET error_message = $2 WHERE id = $1")
        .bind(id)
        .bind(error)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn mark_canonicalized(pool: &PgPool, id: uuid::Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"UPDATE fec_bulk_batches
           SET status = 'canonicalized', error_message = NULL, canonicalized_at = now()
           WHERE id = $1"#,
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}
