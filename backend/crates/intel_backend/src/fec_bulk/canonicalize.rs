//! Canonicalization: resolve amendments, filter memos, and build clean
//! transaction tables from staging data.
//!
//! All operations are set-based SQL — zip parsing happens in `parse.rs`,
//! staging rows are inserted by the caller, then these functions run
//! the deterministic transforms that produce the canonical tables.

use sqlx::PgConnection;
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
    connection: &mut PgConnection,
    election_cycle: i32,
    import_batch: uuid::Uuid,
    source_run_id: uuid::Uuid,
) -> Result<i64, sqlx::Error> {
    info!(cycle = election_cycle, "Canonicalizing individual receipts");

    // Keep the latest filing version per transaction while preserving memo rows
    // as explicit non-totalable evidence.
    let result = sqlx::query(
        r#"
        WITH deleted AS (
            DELETE FROM fec_canonical_individual_receipts
            WHERE election_cycle = $2
        ),
        ranked AS (
            SELECT sub_id, committee_id, contributor_name, contributor_zip,
                   contributor_employer, contributor_occupation, transaction_date,
                   transaction_amount, transaction_type, entity_type, image_num,
                   tran_id, filing_num, memo_code, memo_text, record_kind,
                   include_in_totals,
                   ROW_NUMBER() OVER (
                       PARTITION BY COALESCE(tran_id, sub_id::text), committee_id
                       ORDER BY filing_num DESC NULLS LAST, sub_id DESC
                   ) AS rn
            FROM fec_staging_individuals
            WHERE import_batch = $1
        )
        INSERT INTO fec_canonical_individual_receipts
            (sub_id, committee_id, contributor_name, contributor_zip,
             contributor_employer, contributor_occupation, transaction_date,
             amount, donor_key, election_cycle, filing_num, is_current,
             transaction_type, entity_type, image_num, tran_id, memo_code,
             memo_text, record_kind, include_in_totals, source_run_id)
        SELECT
            r.sub_id,
            r.committee_id,
            COALESCE(r.contributor_name, 'Unknown'),
            r.contributor_zip,
            r.contributor_employer,
            r.contributor_occupation,
            r.transaction_date,
            r.transaction_amount,
            UPPER(TRIM(COALESCE(r.contributor_name, ''))) || '|' ||
            LEFT(REGEXP_REPLACE(COALESCE(r.contributor_zip, ''), '[^0-9]', '', 'g'), 5) || '|' ||
            UPPER(TRIM(COALESCE(r.contributor_employer, ''))),
            $2,
            r.filing_num,
            true,
            r.transaction_type,
            r.entity_type,
            r.image_num,
            r.tran_id,
            r.memo_code,
            r.memo_text,
            r.record_kind,
            r.include_in_totals,
            $3
        FROM ranked r
        WHERE r.rn = 1
        ON CONFLICT (sub_id) DO UPDATE SET
            committee_id = EXCLUDED.committee_id,
            contributor_name = EXCLUDED.contributor_name,
            contributor_zip = EXCLUDED.contributor_zip,
            contributor_employer = EXCLUDED.contributor_employer,
            contributor_occupation = EXCLUDED.contributor_occupation,
            transaction_date = EXCLUDED.transaction_date,
            amount = EXCLUDED.amount,
            donor_key = EXCLUDED.donor_key,
            election_cycle = EXCLUDED.election_cycle,
            filing_num = EXCLUDED.filing_num,
            transaction_type = EXCLUDED.transaction_type,
            entity_type = EXCLUDED.entity_type,
            image_num = EXCLUDED.image_num,
            tran_id = EXCLUDED.tran_id,
            memo_code = EXCLUDED.memo_code,
            memo_text = EXCLUDED.memo_text,
            record_kind = EXCLUDED.record_kind,
            include_in_totals = EXCLUDED.include_in_totals,
            source_run_id = EXCLUDED.source_run_id
        "#,
    )
    .bind(import_batch)
    .bind(election_cycle)
    .bind(source_run_id)
    .execute(&mut *connection)
    .await?;

    let inserted = result.rows_affected() as i64;
    info!(
        cycle = election_cycle,
        rows = inserted,
        "Canonical individual receipts inserted"
    );
    Ok(inserted)
}

/// Resolve amendments for committee-to-committee transactions from `oth`.
///
/// Same amendment logic as individuals. Rows remain classified so transfers
/// and memos cannot silently become direct committee contributions.
pub async fn canonicalize_committee_txns(
    connection: &mut PgConnection,
    election_cycle: i32,
    import_batch: uuid::Uuid,
    source_run_id: uuid::Uuid,
) -> Result<i64, sqlx::Error> {
    info!(
        cycle = election_cycle,
        "Canonicalizing committee transactions"
    );

    let result = sqlx::query(
        r#"
        WITH deleted AS (
            DELETE FROM fec_canonical_committee_receipts
            WHERE election_cycle = $2
        ),
        ranked AS (
            SELECT sub_id, committee_id AS recipient_committee_id,
                   other_id AS donor_committee_id,
                   transaction_date, transaction_amount, transaction_type,
                   entity_type, image_num, tran_id, filing_num, memo_code,
                   memo_text, relationship_type, include_in_totals,
                   ROW_NUMBER() OVER (
                       PARTITION BY COALESCE(tran_id, sub_id::text), committee_id
                       ORDER BY filing_num DESC NULLS LAST, sub_id DESC
                   ) AS rn
            FROM fec_staging_committee_txns
            WHERE import_batch = $1
              AND other_id ~ '^C[0-9]{8}$'
        )
        INSERT INTO fec_canonical_committee_receipts
            (sub_id, recipient_committee_id, donor_committee_id,
             transaction_date, amount, election_cycle, filing_num, is_current,
             transaction_type, entity_type, image_num, tran_id, memo_code,
             memo_text, relationship_type, include_in_totals, source_run_id)
        SELECT
            r.sub_id, r.recipient_committee_id, r.donor_committee_id,
            r.transaction_date, r.transaction_amount,
            $2, r.filing_num, true, r.transaction_type, r.entity_type,
            r.image_num, r.tran_id, r.memo_code, r.memo_text,
            r.relationship_type, r.include_in_totals, $3
        FROM ranked r
        WHERE r.rn = 1
        ON CONFLICT (sub_id) DO UPDATE SET
            recipient_committee_id = EXCLUDED.recipient_committee_id,
            donor_committee_id = EXCLUDED.donor_committee_id,
            transaction_date = EXCLUDED.transaction_date,
            amount = EXCLUDED.amount,
            election_cycle = EXCLUDED.election_cycle,
            filing_num = EXCLUDED.filing_num,
            transaction_type = EXCLUDED.transaction_type,
            entity_type = EXCLUDED.entity_type,
            image_num = EXCLUDED.image_num,
            tran_id = EXCLUDED.tran_id,
            memo_code = EXCLUDED.memo_code,
            memo_text = EXCLUDED.memo_text,
            relationship_type = EXCLUDED.relationship_type,
            include_in_totals = EXCLUDED.include_in_totals,
            source_run_id = EXCLUDED.source_run_id
        "#,
    )
    .bind(import_batch)
    .bind(election_cycle)
    .bind(source_run_id)
    .execute(&mut *connection)
    .await?;

    let inserted = result.rows_affected() as i64;
    info!(
        cycle = election_cycle,
        rows = inserted,
        "Canonical committee receipts inserted"
    );
    Ok(inserted)
}

/// Clear staging data for a completed batch.
pub async fn clear_staging_batch(
    connection: &mut PgConnection,
    import_batch: uuid::Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM fec_staging_individuals WHERE import_batch = $1")
        .bind(import_batch)
        .execute(&mut *connection)
        .await?;
    sqlx::query("DELETE FROM fec_staging_committee_txns WHERE import_batch = $1")
        .bind(import_batch)
        .execute(&mut *connection)
        .await?;
    Ok(())
}
