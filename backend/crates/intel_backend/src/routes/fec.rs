use crate::models::AppError;
use crate::routes::AppState;
use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct CandidateQuery {
    pub name: Option<String>,
    pub state: Option<String>,
    pub party: Option<String>,
    pub cycle: Option<i32>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct IntelCandidate {
    pub candidate_id: String,
    pub name: String,
    pub party: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub office: Option<String>,
    pub incumbent_challenge: Option<String>,
    pub active_through: Option<i32>,
    pub first_file_date: Option<String>,
    pub last_file_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CommitteeQuery {
    pub name: Option<String>,
    pub state: Option<String>,
    pub party: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct IntelCommittee {
    pub committee_id: String,
    pub name: String,
    pub committee_type: Option<String>,
    pub committee_type_full: Option<String>,
    pub designation: Option<String>,
    pub designation_full: Option<String>,
    pub party: Option<String>,
    pub state: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReceiptQuery {
    pub committee_id: Option<String>,
    pub cycle: Option<i32>,
    pub q: Option<String>,
    pub record_kind: Option<String>,
    pub min_amount: Option<f64>,
    pub max_amount: Option<f64>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct FecReceiptRecord {
    pub source_record_id: String,
    pub committee_id: String,
    pub committee_name: String,
    pub contributor_name: String,
    pub contributor_committee_id: Option<String>,
    pub contributor_type: String,
    pub contribution_date: Option<chrono::NaiveDate>,
    pub amount: f64,
    pub employer: Option<String>,
    pub occupation: Option<String>,
    pub transaction_type: Option<String>,
    pub record_kind: String,
    pub memo_text: Option<String>,
    pub include_in_totals: bool,
    pub source_url: Option<String>,
    #[serde(skip)]
    pub total_items: i64,
}

#[derive(Debug, Serialize)]
pub struct Paging {
    pub page: i64,
    pub size: i64,
    pub total_items: i64,
    pub total_pages: i64,
    pub total_is_exact: bool,
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct ReceiptMeta {
    pub paging: Paging,
    pub cycle: i32,
    pub coverage_status: String,
    pub unresolved_linkage_issues: i64,
    pub source_updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ReceiptProvenance {
    pub source: String,
    pub source_url: String,
    pub scope: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct FecReceiptsResponse {
    pub data: Vec<FecReceiptRecord>,
    pub meta: ReceiptMeta,
    pub provenance: ReceiptProvenance,
}

#[derive(Debug, Deserialize)]
pub struct DisbursementQuery {
    pub committee_id: Option<String>,
    pub cycle: Option<i32>,
    pub q: Option<String>,
    pub min_amount: Option<f64>,
    pub max_amount: Option<f64>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct FecDisbursementRecord {
    pub source_record_id: String,
    pub committee_id: String,
    pub committee_name: String,
    pub recipient_name: String,
    pub transaction_date: Option<chrono::NaiveDate>,
    pub amount: f64,
    pub purpose: Option<String>,
    pub category_code: Option<String>,
    pub category_description: Option<String>,
    pub memo_code: Option<String>,
    pub memo_text: Option<String>,
    pub entity_type: Option<String>,
    pub source_url: String,
    #[serde(skip)]
    pub total_items: i64,
}

#[derive(Debug, Serialize)]
pub struct FecDisbursementsResponse {
    pub data: Vec<FecDisbursementRecord>,
    pub meta: ReceiptMeta,
    pub provenance: ReceiptProvenance,
}

fn receipt_coverage_status(
    archive_count: i64,
    canonicalized_count: i64,
    unresolved_linkage_issues: i64,
) -> &'static str {
    if canonicalized_count == 2 && unresolved_linkage_issues == 0 {
        "loaded"
    } else if archive_count > 0 {
        "partial"
    } else {
        "not_ingested"
    }
}

/// GET /api/fec/candidates
///
/// Returns FEC candidate records from the database with optional filters.
pub async fn list_candidates(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CandidateQuery>,
) -> Result<Json<Vec<IntelCandidate>>, AppError> {
    let limit_val = query.limit.unwrap_or(200);
    let pool = state.repo.pool();

    let name_filter = query.name.unwrap_or_default();
    let state_filter = query.state.unwrap_or_default();
    let party_filter = query.party.unwrap_or_default();
    let cycle_val = query.cycle.unwrap_or(0);

    let candidates: Vec<IntelCandidate> = sqlx::query_as(
        r#"SELECT candidate_id, name, party, state, district, office,
                  incumbent_challenge, active_through,
                  first_file_date::text AS first_file_date,
                  last_file_date::text AS last_file_date
           FROM fec_candidates
           WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')
             AND ($2 = '' OR state = $2)
             AND ($3 = '' OR party = $3)
             AND ($4 = 0 OR active_through >= $4)
           ORDER BY name ASC
           LIMIT $5"#,
    )
    .bind(&name_filter)
    .bind(&state_filter)
    .bind(&party_filter)
    .bind(cycle_val)
    .bind(limit_val)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(candidates))
}

/// GET /api/fec/committees
///
/// Returns FEC committee records from the database with optional filters.
pub async fn list_committees(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CommitteeQuery>,
) -> Result<Json<Vec<IntelCommittee>>, AppError> {
    let limit_val = query.limit.unwrap_or(200);
    let pool = state.repo.pool();

    let name_filter = query.name.unwrap_or_default();
    let state_filter = query.state.unwrap_or_default();
    let party_filter = query.party.unwrap_or_default();

    let committees: Vec<IntelCommittee> = sqlx::query_as(
        r#"SELECT committee_id, name, committee_type, committee_type_full,
                  designation, designation_full, party, state
           FROM fec_committees
           WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')
             AND ($2 = '' OR state = $2)
             AND ($3 = '' OR party = $3)
           ORDER BY name ASC
           LIMIT $4"#,
    )
    .bind(&name_filter)
    .bind(&state_filter)
    .bind(&party_filter)
    .bind(limit_val)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(committees))
}

/// GET /api/fec/receipts
///
/// Browses pre-canonicalized itemized receipts. Memo, refund, transfer, and
/// outside-spending records remain visible but are explicitly non-totalable.
pub async fn list_receipts(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ReceiptQuery>,
) -> Result<Json<FecReceiptsResponse>, AppError> {
    use chrono::Datelike;

    let year = chrono::Utc::now().year();
    let default_cycle = if year % 2 == 0 { year } else { year + 1 };
    let cycle = query.cycle.unwrap_or(default_cycle);
    if cycle < 1980 || cycle % 2 != 0 {
        return Err(AppError::BadRequest(
            "cycle must be an even FEC election year".to_string(),
        ));
    }
    let page = query.page.unwrap_or(1);
    let per_page = query.per_page.unwrap_or(50).min(200);
    if page < 1 || per_page < 1 {
        return Err(AppError::BadRequest(
            "page and per_page must be positive".to_string(),
        ));
    }
    if query
        .min_amount
        .zip(query.max_amount)
        .is_some_and(|(minimum, maximum)| minimum > maximum)
    {
        return Err(AppError::BadRequest(
            "min_amount cannot exceed max_amount".to_string(),
        ));
    }

    let committee_id = query.committee_id.unwrap_or_default();
    let search = query.q.unwrap_or_default();
    let record_kind = query.record_kind.unwrap_or_default();
    let offset = (page - 1) * per_page;
    let has_filters = !committee_id.is_empty()
        || !search.is_empty()
        || !record_kind.is_empty()
        || query.min_amount.is_some()
        || query.max_amount.is_some();
    let known_total: Option<i64> = if has_filters {
        None
    } else {
        sqlx::query_scalar(
            "SELECT COALESCE(individual_count, 0) + COALESCE(committee_count, 0) FROM fec_receipt_cycle_counts WHERE election_cycle = $1",
        )
        .bind(cycle)
        .fetch_optional(state.repo.pool())
        .await
        .map_err(|error| AppError::Internal(format!("database error: {error}")))?
    };
    let matching_committee_ids: Vec<String> = if search.is_empty() {
        Vec::new()
    } else {
        sqlx::query_scalar(
            "SELECT committee_id FROM fec_committees WHERE name ILIKE '%' || $1 || '%'",
        )
        .bind(&search)
        .fetch_all(state.repo.pool())
        .await
        .map_err(|error| AppError::Internal(format!("database error: {error}")))?
    };
    let total_expression = if known_total.is_some() {
        "$10::bigint"
    } else {
        "0::bigint"
    };
    let individual_search = if search.is_empty() {
        "TRUE"
    } else if matching_committee_ids.is_empty() {
        "receipt.contributor_name ILIKE '%' || $3 || '%'"
    } else {
        "(receipt.contributor_name ILIKE '%' || $3 || '%' OR receipt.committee_id = ANY($9::text[]))"
    };
    let committee_search = if search.is_empty() {
        "TRUE"
    } else if matching_committee_ids.is_empty() {
        "FALSE"
    } else {
        "(receipt.donor_committee_id = ANY($9::text[]) OR receipt.recipient_committee_id = ANY($9::text[]))"
    };
    let individual_source = if known_total.is_some() {
        "(SELECT * FROM fec_canonical_individual_receipts WHERE election_cycle = $1 ORDER BY transaction_date DESC NULLS LAST, sub_id DESC LIMIT ($7 + $8))"
    } else {
        "fec_canonical_individual_receipts"
    };
    let committee_source = if known_total.is_some() {
        "(SELECT * FROM fec_canonical_committee_receipts WHERE election_cycle = $1 ORDER BY transaction_date DESC NULLS LAST, sub_id DESC LIMIT ($7 + $8))"
    } else {
        "fec_canonical_committee_receipts"
    };
    let rows_sql = format!(
        r#"WITH receipt_rows AS (
               SELECT
                   'individual-' || receipt.sub_id::text AS source_record_id,
                   receipt.committee_id,
                   COALESCE(recipient.name, receipt.committee_id) AS committee_name,
                   receipt.contributor_name,
                   NULL::text AS contributor_committee_id,
                   COALESCE(receipt.entity_type, 'individual') AS contributor_type,
                   receipt.transaction_date AS contribution_date,
                   receipt.amount::double precision AS amount,
                   receipt.contributor_employer AS employer,
                   receipt.contributor_occupation AS occupation,
                   receipt.transaction_type,
                   receipt.record_kind,
                   receipt.memo_text,
                   receipt.include_in_totals,
                   CASE WHEN receipt.image_num IS NOT NULL
                        THEN 'https://docquery.fec.gov/cgi-bin/fecimg/?' || receipt.image_num
                   END AS source_url
               FROM {individual_source} receipt
               LEFT JOIN fec_committees recipient
                 ON recipient.committee_id = receipt.committee_id
               WHERE receipt.election_cycle = $1
                 AND ($2 = '' OR receipt.committee_id = $2)
                 AND ({individual_search})
                 AND ($4 = '' OR receipt.record_kind = $4)
                 AND ($5::double precision IS NULL OR receipt.amount >= $5)
                 AND ($6::double precision IS NULL OR receipt.amount <= $6)

               UNION ALL

               SELECT
                   'committee-' || receipt.sub_id::text AS source_record_id,
                   receipt.recipient_committee_id AS committee_id,
                   COALESCE(recipient.name, receipt.recipient_committee_id) AS committee_name,
                   COALESCE(donor.name, receipt.donor_committee_id) AS contributor_name,
                   receipt.donor_committee_id AS contributor_committee_id,
                   'committee'::text AS contributor_type,
                   receipt.transaction_date AS contribution_date,
                   receipt.amount::double precision AS amount,
                   NULL::text AS employer,
                   NULL::text AS occupation,
                   receipt.transaction_type,
                   receipt.relationship_type AS record_kind,
                   receipt.memo_text,
                   receipt.include_in_totals,
                   CASE WHEN receipt.image_num IS NOT NULL
                        THEN 'https://docquery.fec.gov/cgi-bin/fecimg/?' || receipt.image_num
                   END AS source_url
               FROM {committee_source} receipt
               LEFT JOIN fec_committees recipient
                 ON recipient.committee_id = receipt.recipient_committee_id
               LEFT JOIN fec_committees donor
                 ON donor.committee_id = receipt.donor_committee_id
               WHERE receipt.election_cycle = $1
                 AND ($2 = '' OR receipt.recipient_committee_id = $2)
                 AND ({committee_search})
                 AND ($4 = '' OR receipt.relationship_type = $4)
                 AND ($5::double precision IS NULL OR receipt.amount >= $5)
                 AND ($6::double precision IS NULL OR receipt.amount <= $6)
           )
           SELECT receipt_rows.*, {total_expression} AS total_items
           FROM receipt_rows
           ORDER BY contribution_date DESC NULLS LAST, source_record_id DESC
           LIMIT $7 OFFSET $8"#
    );
    let fetch_limit = if known_total.is_some() {
        per_page
    } else {
        per_page + 1
    };
    let mut rows_query = sqlx::query_as::<_, FecReceiptRecord>(&rows_sql)
        .bind(cycle)
        .bind(&committee_id)
        .bind(&search)
        .bind(&record_kind)
        .bind(query.min_amount)
        .bind(query.max_amount)
        .bind(fetch_limit)
        .bind(offset)
        .bind(&matching_committee_ids);
    if let Some(total) = known_total {
        rows_query = rows_query.bind(total);
    }
    let mut rows: Vec<FecReceiptRecord> = rows_query
        .fetch_all(state.repo.pool())
        .await
        .map_err(|error| AppError::Internal(format!("database error: {error}")))?;

    let total_is_exact = known_total.is_some();
    let has_more = if let Some(total) = known_total {
        offset + per_page < total
    } else {
        rows.len() as i64 > per_page
    };
    rows.truncate(per_page as usize);
    let total_items = known_total.unwrap_or(offset + rows.len() as i64 + i64::from(has_more));
    let total_pages = if total_items == 0 {
        0
    } else {
        (total_items + per_page - 1) / per_page
    };
    let (archive_count, canonicalized_count, source_updated_at, unresolved_linkage_issues): (
        i64,
        i64,
        Option<chrono::DateTime<chrono::Utc>>,
        i64,
    ) = sqlx::query_as(
        r#"SELECT COUNT(*)::bigint,
                  COUNT(*) FILTER (WHERE status = 'canonicalized')::bigint,
                  MAX(canonicalized_at),
                  COALESCE((
                      SELECT COUNT(*)::bigint
                      FROM fec_linkage_issues
                      WHERE election_cycle = $1
                        AND resolved_at IS NULL
                  ), 0)::bigint
           FROM (
               SELECT DISTINCT ON (dataset_name)
                      dataset_name, status, canonicalized_at
               FROM fec_bulk_imports
               WHERE election_cycle = $1
                 AND dataset_name IN ($2, $3)
               ORDER BY dataset_name, checked_at DESC, downloaded_at DESC
           ) latest"#,
    )
    .bind(cycle)
    .bind(format!("indiv{}", cycle % 100))
    .bind(format!("oth{}", cycle % 100))
    .fetch_one(state.repo.pool())
    .await
    .map_err(|error| AppError::Internal(format!("database error: {error}")))?;
    let coverage_status = receipt_coverage_status(
        archive_count,
        canonicalized_count,
        unresolved_linkage_issues,
    );
    let mut warnings = vec![
        "Named donor rows cover itemized FEC receipts; unitemized contributions cannot be assigned to people."
            .to_string(),
        "Memo, refund, transfer, and outside-spending records are preserved but excluded from direct-receipt totals."
            .to_string(),
    ];
    if coverage_status != "loaded" {
        warnings.push(format!(
            "Cycle {cycle} bulk ingestion is {coverage_status}; empty results are not evidence of zero receipts."
        ));
    }
    if unresolved_linkage_issues > 0 {
        warnings.push(format!(
            "{unresolved_linkage_issues} official candidate-committee linkage rows reference missing cycle master records and are excluded until the FEC source files reconcile."
        ));
    }

    Ok(Json(FecReceiptsResponse {
        data: rows,
        meta: ReceiptMeta {
            paging: Paging {
                page,
                size: per_page,
                total_items,
                total_pages,
                total_is_exact,
                has_more,
            },
            cycle,
            coverage_status: coverage_status.to_string(),
            unresolved_linkage_issues,
            source_updated_at,
        },
        provenance: ReceiptProvenance {
            source: "Federal Election Commission bulk data".to_string(),
            source_url: "https://www.fec.gov/data/browse-data/".to_string(),
            scope:
                "Canonical itemized receipts for authorized House and Senate candidate committees"
                    .to_string(),
            warnings,
        },
    }))
}

/// GET /api/fec/disbursements
///
/// Browses canonical Schedule B operating disbursements. These records are
/// intentionally excluded from receipt, donor, and contribution totals.
pub async fn list_disbursements(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DisbursementQuery>,
) -> Result<Json<FecDisbursementsResponse>, AppError> {
    use chrono::Datelike;

    let year = chrono::Utc::now().year();
    let default_cycle = if year % 2 == 0 { year } else { year + 1 };
    let cycle = query.cycle.unwrap_or(default_cycle);
    if cycle < 1980 || cycle % 2 != 0 {
        return Err(AppError::BadRequest(
            "cycle must be an even FEC election year".to_string(),
        ));
    }
    let page = query.page.unwrap_or(1);
    let per_page = query.per_page.unwrap_or(50).min(200);
    if page < 1 || per_page < 1 {
        return Err(AppError::BadRequest(
            "page and per_page must be positive".to_string(),
        ));
    }
    if query
        .min_amount
        .zip(query.max_amount)
        .is_some_and(|(minimum, maximum)| minimum > maximum)
    {
        return Err(AppError::BadRequest(
            "min_amount cannot exceed max_amount".to_string(),
        ));
    }

    let committee_id = query.committee_id.unwrap_or_default();
    let search = query.q.unwrap_or_default();
    let offset = (page - 1) * per_page;
    let has_filters = !committee_id.is_empty()
        || !search.is_empty()
        || query.min_amount.is_some()
        || query.max_amount.is_some();
    let known_total: Option<i64> = if has_filters {
        None
    } else {
        sqlx::query_scalar(
            "SELECT item_count FROM fec_disbursement_cycle_counts WHERE election_cycle=$1",
        )
        .bind(cycle)
        .fetch_optional(state.repo.pool())
        .await
        .map_err(|error| AppError::Internal(format!("database error: {error}")))?
    };
    let search_condition = if search.is_empty() {
        "TRUE"
    } else {
        "to_tsvector('simple', d.recipient_name || ' ' || COALESCE(d.purpose,'')) @@ plainto_tsquery('simple', $3)"
    };
    let total_expression = if known_total.is_some() {
        "$8::bigint"
    } else {
        "0::bigint"
    };
    let rows_sql = format!(
        r#"SELECT d.source_record_id,d.committee_id,
                  COALESCE(c.name,d.committee_id) AS committee_name,
                  d.recipient_name,d.transaction_date,d.amount::double precision AS amount,
                  d.purpose,d.category_code,d.category_description,d.memo_code,d.memo_text,
                  d.entity_type,d.source_url,{total_expression} AS total_items
           FROM fec_canonical_operating_disbursements d
           LEFT JOIN fec_committees c ON c.committee_id=d.committee_id
           WHERE d.election_cycle=$1
             AND ($2='' OR d.committee_id=$2)
             AND ({search_condition})
             AND ($4::double precision IS NULL OR d.amount >= $4)
             AND ($5::double precision IS NULL OR d.amount <= $5)
           ORDER BY d.transaction_date DESC NULLS LAST,d.sub_id DESC
           LIMIT $6 OFFSET $7"#,
    );
    let fetch_limit = if known_total.is_some() {
        per_page
    } else {
        per_page + 1
    };
    let mut rows_query = sqlx::query_as::<_, FecDisbursementRecord>(&rows_sql)
        .bind(cycle)
        .bind(&committee_id)
        .bind(&search)
        .bind(query.min_amount)
        .bind(query.max_amount)
        .bind(fetch_limit)
        .bind(offset);
    if let Some(total) = known_total {
        rows_query = rows_query.bind(total);
    }
    let mut rows: Vec<FecDisbursementRecord> = rows_query
        .fetch_all(state.repo.pool())
        .await
        .map_err(|error| AppError::Internal(format!("database error: {error}")))?;
    let has_more = if let Some(total) = known_total {
        offset + per_page < total
    } else {
        rows.len() as i64 > per_page
    };
    rows.truncate(per_page as usize);
    let total_items = known_total.unwrap_or(offset + rows.len() as i64 + i64::from(has_more));
    let total_pages = if total_items == 0 {
        0
    } else {
        (total_items + per_page - 1) / per_page
    };
    let (archive_count, canonicalized_count, source_updated_at): (
        i64,
        i64,
        Option<chrono::DateTime<chrono::Utc>>,
    ) = sqlx::query_as(
        r#"SELECT COUNT(*)::bigint,
                  COUNT(*) FILTER (WHERE status='canonicalized')::bigint,
                  MAX(canonicalized_at)
           FROM (SELECT DISTINCT ON (dataset_name) dataset_name,status,canonicalized_at
                 FROM fec_bulk_imports
                 WHERE election_cycle=$1 AND dataset_name=$2
                 ORDER BY dataset_name,checked_at DESC,downloaded_at DESC) latest"#,
    )
    .bind(cycle)
    .bind(format!("oppexp{}", cycle % 100))
    .fetch_one(state.repo.pool())
    .await
    .map_err(|error| AppError::Internal(format!("database error: {error}")))?;
    let coverage_status = if archive_count == 1 && canonicalized_count == 1 {
        "loaded"
    } else if archive_count > 0 {
        "partial"
    } else {
        "not_ingested"
    };
    let mut warnings = vec![
        "Schedule B operating disbursements are separate from campaign receipts and donor totals."
            .to_string(),
        "Memo entries are preserved as reported and may not represent an additional payment."
            .to_string(),
    ];
    if coverage_status != "loaded" {
        warnings.push(format!(
            "Cycle {cycle} disbursement ingestion is {coverage_status}; empty results are not evidence of zero spending."
        ));
    }

    Ok(Json(FecDisbursementsResponse {
        data: rows,
        meta: ReceiptMeta {
            paging: Paging {
                page,
                size: per_page,
                total_items,
                total_pages,
                total_is_exact: known_total.is_some(),
                has_more,
            },
            cycle,
            coverage_status: coverage_status.to_string(),
            unresolved_linkage_issues: 0,
            source_updated_at,
        },
        provenance: ReceiptProvenance {
            source: "Federal Election Commission Schedule B bulk data".to_string(),
            source_url:
                "https://www.fec.gov/campaign-finance-data/operating-expenditures-file-description/"
                    .to_string(),
            scope: "Canonical itemized operating disbursements reported by FEC committees"
                .to_string(),
            warnings,
        },
    }))
}

#[cfg(test)]
mod tests {
    use super::receipt_coverage_status;

    const ROUTE_SOURCE: &str = include_str!("fec.rs");

    #[test]
    fn unresolved_official_linkages_make_receipt_coverage_partial() {
        assert_eq!(receipt_coverage_status(2, 2, 0), "loaded");
        assert_eq!(receipt_coverage_status(2, 2, 1), "partial");
        assert_eq!(receipt_coverage_status(1, 1, 0), "partial");
        assert_eq!(receipt_coverage_status(0, 0, 0), "not_ingested");
    }

    #[test]
    fn disbursement_browse_order_matches_nulls_last_index_contract() {
        assert!(ROUTE_SOURCE.contains("ORDER BY d.transaction_date DESC NULLS LAST,d.sub_id DESC"));
        let migration = include_str!("../../migrations/0040_fec_disbursement_browse_order.sql");
        assert!(migration.contains("transaction_date DESC NULLS LAST"));
        assert!(migration.contains("sub_id DESC"));
    }
}
