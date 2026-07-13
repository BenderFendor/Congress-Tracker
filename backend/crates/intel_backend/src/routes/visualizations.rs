use crate::models::{AppError, ProvenanceSource, ProvenanceSummary};
use crate::routes::AppState;
use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

const SECTOR_LIMIT: usize = 20;
const SECTOR_SUMMARY_SQL: &str = r#"SELECT sector, total_receipts::double precision, committee_count
    FROM fec_campaign_finance_sector_summaries
    WHERE election_cycle = $1
    ORDER BY total_receipts DESC, sector
    LIMIT 20"#;
const CYCLE_SUMMARY_SQL: &str = r#"SELECT total_receipts::double precision,
    total_disbursements::double precision,
    independent_supporting::double precision,
    independent_opposing::double precision,
    committee_count, receipt_count, disbursement_count,
    independent_expenditure_count,
    to_char(refreshed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS refreshed_at
    FROM fec_campaign_finance_cycle_summaries
    WHERE election_cycle = $1"#;

#[derive(Debug, Deserialize)]
pub struct CampaignFinanceQuery {
    pub cycle: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct CampaignFinanceResponse {
    pub cycle: i32,
    pub by_sector: Vec<SectorBreakdown>,
    /// Direct Schedule A receipts received by committees. This never includes
    /// independent expenditures made by outside groups.
    pub total_receipts: f64,
    /// Canonical Schedule B operating disbursements made by committees.
    pub total_disbursements: f64,
    pub independent_expenditures_supporting: f64,
    pub independent_expenditures_opposing: f64,
    pub committee_count: i64,
    pub provenance: ProvenanceSummary,
    pub coverage: CoverageMetadata,
}

#[derive(Debug, Clone, Serialize)]
pub struct SectorBreakdown {
    pub sector: String,
    pub total_receipts: f64,
    pub committee_count: i64,
}

#[derive(Debug, Serialize)]
pub struct CoverageMetadata {
    pub cycles_available: Vec<i32>,
    pub data_freshness: String,
    pub source: String,
    pub direct_receipts: String,
    pub operating_disbursements: String,
    pub independent_expenditures: String,
    pub sector_limit: usize,
}

#[derive(Debug, sqlx::FromRow)]
struct SectorRow {
    sector: String,
    total_receipts: f64,
    committee_count: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct FinanceTotalsRow {
    total_receipts: f64,
    total_disbursements: f64,
    independent_supporting: f64,
    independent_opposing: f64,
    committee_count: i64,
    receipt_count: i64,
    disbursement_count: i64,
    independent_expenditure_count: i64,
    refreshed_at: String,
}

fn top_sectors(rows: Vec<SectorRow>) -> Vec<SectorBreakdown> {
    rows.into_iter()
        .take(SECTOR_LIMIT)
        .map(|row| SectorBreakdown {
            sector: row.sector,
            total_receipts: row.total_receipts,
            committee_count: row.committee_count,
        })
        .collect()
}

fn coverage_status(has_rows: bool, import_loaded: bool) -> String {
    match (has_rows, import_loaded) {
        (true, true) => "loaded",
        (true, false) => "partial",
        (false, true) => "loaded_empty",
        (false, false) => "not_loaded",
    }
    .to_string()
}

/// GET /api/visualizations/campaign-finance
///
/// Returns canonical Schedule A receipts grouped by recipient committee type,
/// canonical Schedule B operating disbursements, and Schedule E outside
/// spending as separate totals. Overall totals are independent of the top-20
/// sector presentation limit.
pub async fn campaign_finance(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CampaignFinanceQuery>,
) -> Result<Json<CampaignFinanceResponse>, AppError> {
    let cycle = query.cycle.unwrap_or(2026);
    let pool = state.repo.pool();

    let available_cycles: Vec<i32> = sqlx::query_scalar(
        "SELECT election_cycle FROM fec_campaign_finance_cycle_summaries
         ORDER BY election_cycle DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|error| AppError::Internal(format!("database error: {error}")))?;

    let sectors: Vec<SectorRow> = sqlx::query_as(SECTOR_SUMMARY_SQL)
        .bind(cycle)
        .fetch_all(pool)
        .await
        .map_err(|error| AppError::Internal(format!("database error: {error}")))?;

    // These exact all-row totals are refreshed by ingestion, so the request
    // path remains bounded regardless of canonical table size.
    let totals: Option<FinanceTotalsRow> = sqlx::query_as(CYCLE_SUMMARY_SQL)
        .bind(cycle)
        .fetch_optional(pool)
        .await
        .map_err(|error| AppError::Internal(format!("database error: {error}")))?;

    let imports: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT dataset_name FROM fec_bulk_imports
         WHERE election_cycle = $1 AND status = 'canonicalized'",
    )
    .bind(cycle)
    .fetch_all(pool)
    .await
    .map_err(|error| AppError::Internal(format!("database error: {error}")))?;
    let has_import = |expected: &str| imports.iter().any(|dataset| dataset == expected);
    let receipts_imported =
        has_import(&format!("indiv{}", cycle % 100)) && has_import(&format!("oth{}", cycle % 100));
    let disbursements_imported = has_import(&format!("oppexp{}", cycle % 100));
    let independent_imported = has_import(&format!("independent_expenditure_{cycle}"));

    let totals = totals.unwrap_or(FinanceTotalsRow {
        total_receipts: 0.0,
        total_disbursements: 0.0,
        independent_supporting: 0.0,
        independent_opposing: 0.0,
        committee_count: 0,
        receipt_count: 0,
        disbursement_count: 0,
        independent_expenditure_count: 0,
        refreshed_at: String::new(),
    });
    let direct_status = coverage_status(totals.receipt_count > 0, receipts_imported);
    let disbursement_status =
        coverage_status(totals.disbursement_count > 0, disbursements_imported);
    let independent_status = coverage_status(
        totals.independent_expenditure_count > 0,
        independent_imported,
    );
    let fully_loaded = receipts_imported && disbursements_imported && independent_imported;
    let has_any_data = totals.receipt_count > 0
        || totals.disbursement_count > 0
        || totals.independent_expenditure_count > 0;
    let refreshed_at = (!totals.refreshed_at.is_empty()).then(|| totals.refreshed_at.clone());

    let mut warnings = vec![
        "Direct receipts, operating disbursements, and independent expenditures are separate FEC reporting channels and are not combined.".to_string(),
        format!("Sector rankings show the top {SECTOR_LIMIT} committee types; headline totals cover every canonical row for the cycle."),
    ];
    if !fully_loaded {
        warnings.push(
            "At least one canonical FEC channel is not loaded for this cycle; do not interpret a missing channel as a factual zero."
                .to_string(),
        );
    }

    Ok(Json(CampaignFinanceResponse {
        cycle,
        by_sector: top_sectors(sectors),
        total_receipts: totals.total_receipts,
        total_disbursements: totals.total_disbursements,
        independent_expenditures_supporting: totals.independent_supporting,
        independent_expenditures_opposing: totals.independent_opposing,
        committee_count: totals.committee_count,
        provenance: ProvenanceSummary {
            sources: vec![
                ProvenanceSource {
                    source: "fec_canonical_schedule_a".to_string(),
                    status: direct_status.clone(),
                    fetched_at: refreshed_at.clone(),
                    confidence: Some("verified".to_string()),
                },
                ProvenanceSource {
                    source: "fec_canonical_schedule_b".to_string(),
                    status: disbursement_status.clone(),
                    fetched_at: refreshed_at.clone(),
                    confidence: Some("verified".to_string()),
                },
                ProvenanceSource {
                    source: "fec_canonical_schedule_e".to_string(),
                    status: independent_status.clone(),
                    fetched_at: refreshed_at,
                    confidence: Some("verified".to_string()),
                },
            ],
            warnings,
        },
        coverage: CoverageMetadata {
            cycles_available: available_cycles,
            data_freshness: if fully_loaded {
                "loaded"
            } else if has_any_data {
                "partial"
            } else {
                "no_data"
            }
            .to_string(),
            source: "Canonical FEC Schedule A, Schedule B, and Schedule E bulk data".to_string(),
            direct_receipts: direct_status,
            operating_disbursements: disbursement_status,
            independent_expenditures: independent_status,
            sector_limit: SECTOR_LIMIT,
        },
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn top_sector_limit_does_not_define_headline_totals() {
        let rows: Vec<SectorRow> = (1..=25)
            .map(|index| SectorRow {
                sector: format!("Sector {index}"),
                total_receipts: index as f64,
                committee_count: 1,
            })
            .collect();
        let canonical_total: f64 = rows.iter().map(|row| row.total_receipts).sum();

        let displayed = top_sectors(rows);

        assert_eq!(displayed.len(), SECTOR_LIMIT);
        assert_eq!(canonical_total, 325.0);
        assert_ne!(
            displayed.iter().map(|row| row.total_receipts).sum::<f64>(),
            canonical_total,
            "headline totals must be computed from canonical rows, not the top-N display"
        );
    }

    #[test]
    fn coverage_distinguishes_loaded_empty_from_missing_import() {
        assert_eq!(coverage_status(true, true), "loaded");
        assert_eq!(coverage_status(true, false), "partial");
        assert_eq!(coverage_status(false, true), "loaded_empty");
        assert_eq!(coverage_status(false, false), "not_loaded");
    }

    #[test]
    fn interactive_queries_are_bounded_to_summary_tables() {
        for query in [SECTOR_SUMMARY_SQL, CYCLE_SUMMARY_SQL] {
            assert!(query.contains("_summaries"));
            assert!(!query.contains("fec_canonical_"));
            assert!(!query.contains("fec_independent_expenditures"));
        }
        assert!(SECTOR_SUMMARY_SQL.contains("LIMIT 20"));
    }
}
