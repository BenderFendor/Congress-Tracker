//! Intel-backed portfolio routes.
//!
//! These routes replace the CapitolTrades-dependent portfolio endpoints
//! (which are JS-blocked) with real member- and committee-level data
//! from the Postgres database.

use crate::models::AppError;
use crate::routes::AppState;
use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

// ── Query params ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct MembersQuery {
    pub sort_by: Option<String>, // "years", "committees", "ideology", "name"
    pub limit: Option<i64>,
}

// ── Response types ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct PortfolioSummary {
    pub total_members: i64,
    pub total_committees: i64,
    pub in_office_count: i64,
    pub house_count: i64,
    pub senate_count: i64,
    pub democratic_count: i64,
    pub republican_count: i64,
    pub independent_count: i64,
    pub avg_years_in_office: f64,
    pub avg_ideology_score: f64, // mean absolute DW-NOMINATE dim1
}

#[derive(Debug, Serialize)]
pub struct PortfolioMember {
    pub rank: i64,
    pub bioguide_id: String,
    pub first_name: String,
    pub last_name: String,
    pub full_name: String,
    pub party: String,
    pub state: String,
    pub chamber: String,
    pub years_in_office: f64,
    pub committee_count: i64,
    pub ideology_score: Option<f64>,
    pub depiction_url: Option<String>,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct PortfolioMembersResponse {
    pub members: Vec<PortfolioMember>,
    pub sort_by: String,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct SectorWeight {
    pub sector: String,
    pub weight: f64, // percentage of committees mapped to this sector
    pub committee_count: i64,
}

#[derive(Debug, Serialize)]
pub struct SectorExposureResponse {
    pub basis: String,
    pub sectors: Vec<SectorWeight>,
}

#[derive(Debug, Serialize)]
pub struct PulseResponse {
    pub status: String,
    pub message: String,
    pub total_members_tracked: i64,
    pub total_committees: i64,
}

// ── Row types for direct DB queries ─────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct MemberAggRow {
    total_members: i64,
    in_office_count: i64,
    house_count: i64,
    senate_count: i64,
    democratic_count: i64,
    republican_count: i64,
    independent_count: i64,
    avg_years_in_office: Option<f64>,
    avg_ideology_score: Option<f64>,
}

#[derive(sqlx::FromRow)]
struct MemberRankRow {
    bioguide_id: String,
    first_name: String,
    last_name: String,
    current_party: String,
    current_state: String,
    current_chamber: String,
    years_in_office: Option<f64>,
    committee_count: Option<i64>,
    nominate_dim1: Option<f64>,
    depiction_url: Option<String>,
    total: i64,
}

#[derive(sqlx::FromRow)]
struct CommitteeJurisRow {
    name: String,
    chamber: String,
    jurisdiction: Option<String>,
}

// ── Handlers ────────────────────────────────────────────────────────────────

/// GET /api/intel/portfolio/summary
///
/// Returns aggregate member + committee stats from the database.
pub async fn summary(
    State(state): State<Arc<AppState>>,
) -> Result<Json<PortfolioSummary>, AppError> {
    let pool = state.repo.pool();

    let agg = sqlx::query_as::<_, MemberAggRow>(
        r#"SELECT
            COUNT(*)::bigint                                                               AS total_members,
            COUNT(*) FILTER (WHERE in_office)::bigint                                       AS in_office_count,
            COUNT(*) FILTER (WHERE current_chamber = 'House')::bigint                       AS house_count,
            COUNT(*) FILTER (WHERE current_chamber = 'Senate')::bigint                      AS senate_count,
            COUNT(*) FILTER (WHERE current_party = 'Democratic')::bigint                    AS democratic_count,
            COUNT(*) FILTER (WHERE current_party = 'Republican')::bigint                    AS republican_count,
            COUNT(*) FILTER (WHERE current_party NOT IN ('Democratic','Republican'))::bigint AS independent_count,
            ROUND(AVG(COALESCE(years_in_office, 0))::numeric, 1)::float8                   AS avg_years_in_office,
            ROUND(AVG(ABS(COALESCE(nominate_dim1, 0)))::numeric, 4)::float8                 AS avg_ideology_score
        FROM members"#,
    )
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    let committee_count: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM committees")
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(PortfolioSummary {
        total_members: agg.total_members,
        total_committees: committee_count,
        in_office_count: agg.in_office_count,
        house_count: agg.house_count,
        senate_count: agg.senate_count,
        democratic_count: agg.democratic_count,
        republican_count: agg.republican_count,
        independent_count: agg.independent_count,
        avg_years_in_office: agg.avg_years_in_office.unwrap_or(0.0),
        avg_ideology_score: agg.avg_ideology_score.unwrap_or(0.0),
    }))
}

/// GET /api/intel/portfolio/members?sort_by=years&limit=50
///
/// Returns a ranked list of members sorted by the requested metric.
pub async fn members(
    State(state): State<Arc<AppState>>,
    Query(query): Query<MembersQuery>,
) -> Result<Json<PortfolioMembersResponse>, AppError> {
    let sort_by = query.sort_by.as_deref().unwrap_or("committees");
    let limit = query.limit.unwrap_or(50).min(200);

    let pool = state.repo.pool();

    let order_clause = match sort_by {
        "years" => "COALESCE(m.years_in_office, 0) DESC, m.last_name ASC",
        "committees" => {
            r#"(
            SELECT COUNT(*) FROM committee_memberships cm
            WHERE cm.bioguide_id = m.bioguide_id
        ) DESC, m.last_name ASC"#
        }
        "ideology" => "ABS(COALESCE(m.nominate_dim1, 0)) DESC, m.last_name ASC",
        "name" => "m.last_name ASC, m.first_name ASC",
        _ => "COALESCE(m.years_in_office, 0) DESC, m.last_name ASC",
    };

    let sql = format!(
        r#"SELECT
            m.bioguide_id,
            m.first_name,
            m.last_name,
            m.current_party,
            m.current_state,
            m.current_chamber,
            m.years_in_office,
            (SELECT COUNT(*) FROM committee_memberships cm WHERE cm.bioguide_id = m.bioguide_id) AS committee_count,
            m.nominate_dim1,
            m.depiction_url,
            COUNT(*) OVER ()::bigint AS total
        FROM members m
        WHERE m.in_office = true
        ORDER BY {}
        LIMIT $1"#,
        order_clause
    );

    let rows: Vec<MemberRankRow> = sqlx::query_as::<_, MemberRankRow>(&sql)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    let total = rows.first().map(|r| r.total).unwrap_or(0);

    let members: Vec<PortfolioMember> = rows
        .into_iter()
        .enumerate()
        .map(|(i, r)| {
            let full_name = format!("{} {}", r.first_name, r.last_name);
            PortfolioMember {
                rank: (i + 1) as i64,
                bioguide_id: r.bioguide_id,
                first_name: r.first_name,
                last_name: r.last_name,
                full_name,
                party: r.current_party,
                state: r.current_state,
                chamber: r.current_chamber,
                years_in_office: r.years_in_office.unwrap_or(0.0),
                committee_count: r.committee_count.unwrap_or(0),
                ideology_score: r.nominate_dim1,
                depiction_url: r.depiction_url,
                total,
            }
        })
        .collect();

    Ok(Json(PortfolioMembersResponse {
        members,
        sort_by: sort_by.to_string(),
        total,
    }))
}

/// GET /api/intel/portfolio/sectors
///
/// Maps committee jurisdictions to broad policy-sector categories.
/// This is the "sector exposure" equivalent — which policy areas
/// Congress has committees overseeing.
pub async fn sectors(
    State(state): State<Arc<AppState>>,
) -> Result<Json<SectorExposureResponse>, AppError> {
    let pool = state.repo.pool();

    let rows: Vec<CommitteeJurisRow> = sqlx::query_as::<_, CommitteeJurisRow>(
        r#"SELECT name, chamber, jurisdiction
           FROM committees
           ORDER BY name"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    let mut sector_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for row in &rows {
        let text = format!(
            "{} {} {}",
            row.name,
            row.jurisdiction.as_deref().unwrap_or(""),
            row.chamber
        );
        let sector = classify_committee_sector(&text);
        *sector_map.entry(sector.to_string()).or_insert(0) += 1;
    }

    let total: i64 = sector_map.values().sum();
    let mut sectors: Vec<SectorWeight> = sector_map
        .into_iter()
        .map(|(sector, count)| SectorWeight {
            sector,
            weight: if total > 0 {
                ((count as f64 / total as f64) * 1000.0).round() / 10.0
            } else {
                0.0
            },
            committee_count: count,
        })
        .collect();

    sectors.sort_by_key(|sector| std::cmp::Reverse(sector.committee_count));

    Ok(Json(SectorExposureResponse {
        basis: "committee_jurisdiction".to_string(),
        sectors,
    }))
}

/// GET /api/intel/portfolio/pulse
///
/// Returns a status message indicating that CapitolTrades ingestion is needed.
pub async fn pulse() -> Result<Json<PulseResponse>, AppError> {
    Ok(Json(PulseResponse {
        status: "data_pending".to_string(),
        message: "CapitolTrades ingestion needed for stock trade data".to_string(),
        total_members_tracked: 0,
        total_committees: 0,
    }))
}

// ── Committee jurisdiction → sector classifier ──────────────────────────────

fn classify_committee_sector(text: &str) -> &str {
    let lower = text.to_lowercase();

    if lower.contains("armed services")
        || lower.contains("defense")
        || lower.contains("homeland security")
        || lower.contains("intelligence")
        || lower.contains("veterans")
        || lower.contains("military")
        || lower.contains("naval")
        || lower.contains("foreign affairs")
        || lower.contains("foreign relations")
    {
        "Defense & Foreign Affairs"
    } else if lower.contains("appropriations")
        || lower.contains("budget")
        || lower.contains("finance")
        || lower.contains("banking")
        || lower.contains("financial")
        || lower.contains("tax")
        || lower.contains("revenue")
        || lower.contains("economic")
        || lower.contains("small business")
        || lower.contains("ways and means")
    {
        "Finance & Economy"
    } else if lower.contains("health")
        || lower.contains("education")
        || lower.contains("labor")
        || lower.contains("workforce")
        || lower.contains("human services")
        || lower.contains("welfare")
        || lower.contains("pension")
    {
        "Health & Education"
    } else if lower.contains("energy")
        || lower.contains("natural resources")
        || lower.contains("environment")
        || lower.contains("climate")
        || lower.contains("public works")
        || lower.contains("transportation")
        || lower.contains("infrastructure")
        || lower.contains("agriculture")
        || lower.contains("interior")
    {
        "Energy & Environment"
    } else if lower.contains("judiciary")
        || lower.contains("oversight")
        || lower.contains("reform")
        || lower.contains("government")
        || lower.contains("rules")
        || lower.contains("administration")
        || lower.contains("ethics")
        || lower.contains("election")
    {
        "Government & Judiciary"
    } else if lower.contains("commerce")
        || lower.contains("science")
        || lower.contains("technology")
        || lower.contains("space")
        || lower.contains("telecommunication")
        || lower.contains("internet")
        || lower.contains("digital")
        || lower.contains("innovation")
    {
        "Commerce & Technology"
    } else if lower.contains("indian")
        || lower.contains("native")
        || lower.contains("aging")
        || lower.contains("nutrition")
        || lower.contains("hunger")
        || lower.contains("library")
        || lower.contains("printing")
        || lower.contains("joint")
    {
        "Special & Joint"
    } else {
        "Other"
    }
}
