//! Precomputed donor and committee rankings per candidate per cycle.
//!
//! Runs after canonicalization. Aggregates canonical receipts by
//! candidate (via candidate-committee crosswalk), groups by donor_key
//! or committee_id, and stores the top 20 per ranking type.

use sqlx::PgPool;
use tracing::info;

/// Rebuild donor rankings for all candidates in a given cycle.
///
/// For each candidate in `fec_candidates`, resolves their authorized
/// committees via `fec_candidate_committees`, aggregates individual
/// receipts by donor_key, and inserts the top 20.
pub async fn build_donor_rankings(
    pool: &PgPool,
    election_cycle: i32,
) -> Result<i64, sqlx::Error> {
    info!(cycle = election_cycle, "Building donor rankings");

    // Clear previous rankings for this cycle
    sqlx::query("DELETE FROM fec_candidate_donor_rankings WHERE election_cycle = $1")
        .bind(election_cycle)
        .execute(pool)
        .await?;

    // Build donor rankings per candidate via their authorized committees
    let result = sqlx::query(
        r#"
        WITH candidate_committees AS (
            SELECT DISTINCT cc.candidate_id, cc.committee_id
            FROM fec_candidate_committees cc
            WHERE cc.election_cycle = $1
        ),
        donor_agg AS (
            SELECT
                cc.candidate_id,
                r.donor_key,
                MAX(r.contributor_name) AS display_name,
                SUM(r.amount) AS total_amount,
                COUNT(*) AS contribution_count,
                MAX(r.transaction_date) AS most_recent_date
            FROM fec_canonical_individual_receipts r
            JOIN candidate_committees cc ON cc.committee_id = r.committee_id
            WHERE r.election_cycle = $1
              AND r.is_current = true
            GROUP BY cc.candidate_id, r.donor_key
        ),
        ranked AS (
            SELECT *,
                   ROW_NUMBER() OVER (
                       PARTITION BY candidate_id
                       ORDER BY total_amount DESC, contribution_count DESC
                   ) AS rank
            FROM donor_agg
        )
        INSERT INTO fec_candidate_donor_rankings
            (candidate_id, election_cycle, donor_key, display_name,
             total_amount, contribution_count, most_recent_date, rank)
        SELECT
            candidate_id, $1, donor_key, display_name,
            total_amount, contribution_count, most_recent_date, rank
        FROM ranked
        WHERE rank <= 20
        "#,
    )
    .bind(election_cycle)
    .execute(pool)
    .await?;

    let inserted = result.rows_affected() as i64;
    info!(cycle = election_cycle, rows = inserted, "Donor rankings built");
    Ok(inserted)
}

/// Rebuild committee rankings for all candidates in a given cycle.
///
/// Three ranking types:
/// - `contribution`: direct PAC/committee contributions to candidate committees
/// - `independent_expenditure`: IE activity (via fec_transactions with ie type)
/// - `transfer`: transfers between authorized committees
pub async fn build_committee_rankings(
    pool: &PgPool,
    election_cycle: i32,
) -> Result<i64, sqlx::Error> {
    info!(cycle = election_cycle, "Building committee rankings");

    // Clear previous rankings for this cycle
    sqlx::query("DELETE FROM fec_candidate_committee_rankings WHERE election_cycle = $1")
        .bind(election_cycle)
        .execute(pool)
        .await?;

    // Committee rankings from canonical committee receipts (contributions)
    let result = sqlx::query(
        r#"
        WITH candidate_committees AS (
            SELECT DISTINCT cc.candidate_id, cc.committee_id
            FROM fec_candidate_committees cc
            WHERE cc.election_cycle = $1
        ),
        comm_agg AS (
            SELECT
                cc.candidate_id,
                r.donor_committee_id,
                COALESCE(fc.name, r.donor_committee_id) AS committee_name,
                SUM(r.amount) AS total_amount,
                COUNT(*) AS transaction_count
            FROM fec_canonical_committee_receipts r
            JOIN candidate_committees cc ON cc.committee_id = r.recipient_committee_id
            LEFT JOIN fec_committees fc ON fc.committee_id = r.donor_committee_id
            WHERE r.election_cycle = $1
              AND r.is_current = true
            GROUP BY cc.candidate_id, r.donor_committee_id, fc.name
        ),
        ranked AS (
            SELECT *,
                   ROW_NUMBER() OVER (
                       ORDER BY total_amount DESC, transaction_count DESC
                   ) AS rank
            FROM comm_agg
        )
        INSERT INTO fec_candidate_committee_rankings
            (candidate_id, election_cycle, committee_id, committee_name,
             total_amount, transaction_count, ranking_type, rank)
        SELECT
            candidate_id, $1, donor_committee_id, committee_name,
            total_amount, transaction_count, 'contribution', rank
        FROM ranked
        WHERE rank <= 20
        "#,
    )
    .bind(election_cycle)
    .execute(pool)
    .await?;

    let inserted = result.rows_affected() as i64;
    info!(cycle = election_cycle, rows = inserted, "Committee rankings built");
    Ok(inserted)
}

/// Refresh the member_funding_cycle_mv materialized view.
pub async fn refresh_funding_mv(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("Refreshing member_funding_cycle_mv");
    sqlx::query("REFRESH MATERIALIZED VIEW member_funding_cycle_mv")
        .execute(pool)
        .await?;
    info!("member_funding_cycle_mv refreshed");
    Ok(())
}
