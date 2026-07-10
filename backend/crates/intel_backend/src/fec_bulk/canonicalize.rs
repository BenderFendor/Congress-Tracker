//! Canonicalization: resolve amendments, filter memos, and build clean
//! transaction tables from staging data.
//!
//! All operations are set-based SQL — zip parsing happens in `parse.rs`,
//! staging rows are inserted by the caller, then these functions run
//! the deterministic transforms that produce the canonical tables.

use sqlx::PgPool;
use tracing::info;


/// Resolve amendments for individual receipts in the staging table.
///
/// For each `(tran_id, committee_id)`, keeps only the row with the
/// highest `filing_num` (i.e. the latest amendment). Excludes:
/// - Rows where `amendment_ind = 'T'` (terminated)
/// - Memo entries (`memo_code = 'X'`)
/// - Non-receipt transaction types (only `10`, `15`, `15E`, `17`, `17Z` etc. are actual contributions; we keep all with valid sub_id since the staging table already contains only schedule A data)
///
/// Produces rows in `fec_canonical_individual_receipts`.
pub async fn canonicalize_individuals(
    pool: &PgPool,
    election_cycle: i32,
    import_batch: uuid::Uuid,
) -> Result<i64, sqlx::Error> {
    info!(cycle = election_cycle, "Canonicalizing individual receipts");

    // Step 1: Remove terminated and memo rows, keep only current version
    // by ranking filing_num per (tran_id, committee_id).
    let result = sqlx::query(
        r#"
        WITH ranked AS (
            SELECT sub_id, committee_id, contributor_name, contributor_zip,
                   contributor_employer, transaction_date, transaction_amount,
                   tran_id, filing_num,
                   ROW_NUMBER() OVER (
                       PARTITION BY COALESCE(tran_id, sub_id::text), committee_id
                       ORDER BY filing_num DESC NULLS LAST, sub_id DESC
                   ) AS rn
            FROM fec_staging_individuals
            WHERE import_batch = $1
              AND (amendment_ind IS NULL OR amendment_ind != 'T')
              AND (memo_code IS NULL OR memo_code != 'X')
        )
        INSERT INTO fec_canonical_individual_receipts
            (sub_id, committee_id, contributor_name, contributor_zip,
             contributor_employer, transaction_date, amount, donor_key,
             election_cycle, filing_num, is_current)
        SELECT
            r.sub_id,
            r.committee_id,
            COALESCE(r.contributor_name, 'Unknown'),
            r.contributor_zip,
            r.contributor_employer,
            r.transaction_date,
            r.transaction_amount,
            -- Build donor_key via the crate function logic (name|zip5|employer)
            UPPER(TRIM(COALESCE(r.contributor_name, ''))) || '|' ||
            COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(r.contributor_zip, ''), '[^0-9].*$', ''), ''), '') || '|' ||
            UPPER(TRIM(COALESCE(r.contributor_employer, ''))),
            $2,
            r.filing_num,
            true
        FROM ranked r
        WHERE r.rn = 1
        ON CONFLICT (sub_id) DO NOTHING
        "#,
    )
    .bind(import_batch)
    .bind(election_cycle)
    .execute(pool)
    .await?;

    let inserted = result.rows_affected() as i64;
    info!(cycle = election_cycle, rows = inserted, "Canonical individual receipts inserted");
    Ok(inserted)
}

/// Resolve amendments for committee-to-committee transactions from `oth`.
///
/// Same amendment logic as individuals. Only includes rows where `other_id`
/// is present (identifies the donor committee). Excludes memos.
pub async fn canonicalize_committee_txns(
    pool: &PgPool,
    election_cycle: i32,
    import_batch: uuid::Uuid,
) -> Result<i64, sqlx::Error> {
    info!(cycle = election_cycle, "Canonicalizing committee transactions");

    let result = sqlx::query(
        r#"
        WITH ranked AS (
            SELECT sub_id, committee_id AS recipient_committee_id,
                   other_id AS donor_committee_id,
                   transaction_date, transaction_amount,
                   tran_id, filing_num,
                   ROW_NUMBER() OVER (
                       PARTITION BY COALESCE(tran_id, sub_id::text), committee_id
                       ORDER BY filing_num DESC NULLS LAST, sub_id DESC
                   ) AS rn
            FROM fec_staging_committee_txns
            WHERE import_batch = $1
              AND (amendment_ind IS NULL OR amendment_ind != 'T')
              AND (memo_code IS NULL OR memo_code != 'X')
              AND other_id IS NOT NULL
              AND other_id != ''
        )
        INSERT INTO fec_canonical_committee_receipts
            (sub_id, recipient_committee_id, donor_committee_id,
             transaction_date, amount, election_cycle, filing_num, is_current)
        SELECT
            r.sub_id, r.recipient_committee_id, r.donor_committee_id,
            r.transaction_date, r.transaction_amount,
            $2, r.filing_num, true
        FROM ranked r
        WHERE r.rn = 1
        ON CONFLICT (sub_id) DO NOTHING
        "#,
    )
    .bind(import_batch)
    .bind(election_cycle)
    .execute(pool)
    .await?;

    let inserted = result.rows_affected() as i64;
    info!(cycle = election_cycle, rows = inserted, "Canonical committee receipts inserted");
    Ok(inserted)
}

/// Clear staging data for a completed batch.
pub async fn clear_staging_batch(
    pool: &PgPool,
    import_batch: uuid::Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM fec_staging_individuals WHERE import_batch = $1")
        .bind(import_batch)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM fec_staging_committee_txns WHERE import_batch = $1")
        .bind(import_batch)
        .execute(pool)
        .await?;
    Ok(())
}
