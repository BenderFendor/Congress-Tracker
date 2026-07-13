//! Precomputed donor and committee rankings per candidate per cycle.
//!
//! Runs after canonicalization. Aggregates canonical receipts by
//! candidate (via candidate-committee crosswalk), groups by donor_key
//! or committee_id, and stores the top 20 per ranking type.

use sqlx::PgConnection;
use tracing::info;

/// Rebuild donor rankings for all candidates in a given cycle.
///
/// For each candidate in `fec_candidates`, resolves their authorized
/// committees via `fec_candidate_committees`, aggregates individual
/// receipts by donor_key, and inserts the top 20.
pub async fn build_donor_rankings(
    connection: &mut PgConnection,
    election_cycle: i32,
) -> Result<i64, sqlx::Error> {
    info!(cycle = election_cycle, "Building donor rankings");

    // Clear previous rankings for this cycle
    sqlx::query("DELETE FROM fec_candidate_donor_rankings WHERE election_cycle = $1")
        .bind(election_cycle)
        .execute(&mut *connection)
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
              AND r.include_in_totals = true
              AND r.entity_type = 'IND'
              AND r.contributor_name <> 'Unknown'
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
    .execute(&mut *connection)
    .await?;

    let inserted = result.rows_affected() as i64;
    info!(
        cycle = election_cycle,
        rows = inserted,
        "Donor rankings built"
    );
    Ok(inserted)
}

/// Rebuild committee rankings for all candidates in a given cycle.
///
/// Three ranking types:
/// - `contribution`: direct PAC/committee contributions to candidate committees
/// - `independent_expenditure`: IE activity (via fec_transactions with ie type)
/// - `transfer`: transfers between authorized committees
pub async fn build_committee_rankings(
    connection: &mut PgConnection,
    election_cycle: i32,
) -> Result<i64, sqlx::Error> {
    info!(cycle = election_cycle, "Building committee rankings");

    // Clear previous rankings for this cycle
    sqlx::query("DELETE FROM fec_candidate_committee_rankings WHERE election_cycle = $1")
        .bind(election_cycle)
        .execute(&mut *connection)
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
                CASE WHEN fc.committee_id IS NULL
                     THEN 'unresolved'
                     ELSE 'resolved'
                END AS committee_resolution_status,
                r.relationship_type,
                SUM(r.amount) AS total_amount,
                COUNT(*) AS transaction_count
            FROM fec_canonical_committee_receipts r
            JOIN candidate_committees cc ON cc.committee_id = r.recipient_committee_id
            LEFT JOIN fec_committees fc ON fc.committee_id = r.donor_committee_id
            WHERE r.election_cycle = $1
              AND r.is_current = true
              AND r.relationship_type IN ('contribution', 'transfer')
            GROUP BY cc.candidate_id, r.donor_committee_id, fc.name,
                     fc.committee_id, r.relationship_type
        ),
        ranked AS (
            SELECT *,
                   ROW_NUMBER() OVER (
                       PARTITION BY candidate_id, relationship_type
                       ORDER BY total_amount DESC, transaction_count DESC
                   ) AS rank
            FROM comm_agg
        )
        INSERT INTO fec_candidate_committee_rankings
            (candidate_id, election_cycle, committee_id, committee_name,
             committee_resolution_status, total_amount, transaction_count,
             ranking_type, rank)
        SELECT
            candidate_id, $1, donor_committee_id, committee_name,
            committee_resolution_status, total_amount, transaction_count,
            relationship_type, rank
        FROM ranked
        WHERE rank <= 20
        "#,
    )
    .bind(election_cycle)
    .execute(&mut *connection)
    .await?;

    let inserted = result.rows_affected() as i64;
    info!(
        cycle = election_cycle,
        rows = inserted,
        "Committee rankings built"
    );
    Ok(inserted)
}

/// Refresh the member_funding_cycle_mv materialized view.
pub async fn refresh_funding_mv(connection: &mut PgConnection) -> Result<(), sqlx::Error> {
    info!("Refreshing member_funding_cycle_mv");
    sqlx::query("REFRESH MATERIALIZED VIEW member_funding_cycle_mv")
        .execute(&mut *connection)
        .await?;
    info!("member_funding_cycle_mv refreshed");
    Ok(())
}
