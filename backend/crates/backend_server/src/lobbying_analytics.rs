use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use lobbying_client::{FilingQuery, LobbyingActivity, LobbyingClient};
use serde::{Deserialize, Serialize};

use crate::AppState;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/lobbying/overview", get(overview))
        .route("/api/lobbying/filings", get(filings_list))
        .route("/api/lobbying/influence-flow", get(influence_flow))
        .route("/api/lobbying/top-sectors", get(top_sectors))
}

fn parse_dollar(value: &Option<String>) -> f64 {
    match value {
        Some(s) => s
            .replace([',', '$'], "")
            .trim()
            .parse()
            .unwrap_or(0.0),
        None => 0.0,
    }
}

fn reported_amount(filing: &lobbying_client::Filing) -> f64 {
    let income = parse_dollar(&filing.income);
    let expenses = parse_dollar(&filing.expenses);
    if income > 0.0 {
        income
    } else if expenses > 0.0 {
        expenses
    } else {
        0.0
    }
}

fn initials(name: &str) -> String {
    let parts: Vec<&str> = name.split_whitespace().collect();
    if parts.len() >= 2 {
        format!("{}{}", &parts[0][..1], &parts[1][..1])
    } else if parts.len() == 1 {
        let s = parts[0];
        if s.len() >= 2 {
            s[..2].to_uppercase()
        } else {
            s.to_uppercase()
        }
    } else {
        "??".to_string()
    }
}

async fn fetch_filings_for_year(
    client: &Arc<LobbyingClient>,
    year: u32,
    max_filings: usize,
) -> Result<Vec<lobbying_client::Filing>, (StatusCode, String)> {
    let mut all = Vec::new();
    let mut page: u32 = 1;
    while all.len() < max_filings {
        let query = FilingQuery::default()
            .with_year(year)
            .with_page_size(80)
            .with_page(page);
        match client.get_filings(&query).await {
            Ok(resp) => {
                let before = all.len();
                all.extend(resp.results);
                if all.len() == before || resp.count as usize <= all.len() {
                    break;
                }
            }
            Err(e) => {
                tracing::warn!("LDA fetch page {} year {}: {:?}", page, year, e);
                break;
            }
        }
        page += 1;
        if page > 20 {
            break;
        }
    }
    Ok(all)
}

// ── Overview endpoint ──

#[derive(Serialize)]
struct OverviewResponse {
    year: u32,
    #[serde(rename = "totalReportedLobbying")]
    total_reported_lobbying: f64,
    #[serde(rename = "periodLabel")]
    period_label: String,
    breakdown: Vec<BreakdownItem>,
    #[serde(rename = "sourceNote")]
    source_note: String,
}

#[derive(Serialize)]
struct BreakdownItem {
    label: String,
    amount: f64,
    percent: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    derived: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<String>,
}

#[derive(Deserialize)]
struct OverviewParams {
    year: Option<u32>,
}

async fn overview(
    State(state): State<Arc<AppState>>,
    params: Query<OverviewParams>,
) -> Result<Json<OverviewResponse>, (StatusCode, String)> {
    let client = state.lobbying.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Lobbying API not configured".to_string(),
        )
    })?;

    let year = params.year.unwrap_or(2026);
    let filings = fetch_filings_for_year(client, year, 1000).await?;

    let direct_lobbying: f64 = filings.iter().map(reported_amount).sum();

    let grassroots: f64 = filings
        .iter()
        .filter(|f| has_grassroots_keywords(f))
        .map(|f| reported_amount(f) * 0.25)
        .sum();

    let total = direct_lobbying.max(1.0);

    let direct_pct = ((direct_lobbying - grassroots) / total * 100.0).round();
    let grassroots_pct = if grassroots > 0.0 {
        (grassroots / total * 100.0).round()
    } else {
        0.0
    };

    let breakdown = vec![
        BreakdownItem {
            label: "Direct Lobbying".to_string(),
            amount: (direct_lobbying - grassroots),
            percent: direct_pct,
            derived: None,
            source: Some("LDA LD-2".to_string()),
        },
        BreakdownItem {
            label: "Grassroots".to_string(),
            amount: grassroots,
            percent: grassroots_pct,
            derived: Some(true),
            source: Some("Derived from issue text".to_string()),
        },
        BreakdownItem {
            label: "Outside Spending".to_string(),
            amount: 0.0,
            percent: 0.0,
            derived: Some(true),
            source: Some("FEC independent expenditures".to_string()),
        },
        BreakdownItem {
            label: "Other Influence".to_string(),
            amount: 0.0,
            percent: 0.0,
            derived: Some(true),
            source: Some("LD-203 contributions".to_string()),
        },
    ];

    Ok(Json(OverviewResponse {
        year,
        total_reported_lobbying: direct_lobbying,
        period_label: format!("YTD {}", year),
        breakdown,
        source_note: "LDA filings; Outside Spending and Other Influence are not yet computed"
            .to_string(),
    }))
}

fn has_grassroots_keywords(filing: &lobbying_client::Filing) -> bool {
    if let Some(ref activities) = filing.lobbying_activities {
        for act in activities {
            let desc = act.description.as_deref().unwrap_or("").to_lowercase();
            let issue = act
                .general_issue_code_display
                .as_deref()
                .unwrap_or("")
                .to_lowercase();
            if desc.contains("grassroot")
                || desc.contains("grass-roots")
                || desc.contains("mobilize")
                || desc.contains("mobilization")
                || desc.contains("advocacy campaign")
                || issue.contains("grassroot")
            {
                return true;
            }
        }
    }
    false
}

// ── Filings list endpoint ──

#[derive(Serialize)]
struct FilingsListResponse {
    items: Vec<FilingCardItem>,
    #[serde(rename = "hasMore")]
    has_more: bool,
}

#[derive(Serialize)]
struct FilingCardItem {
    #[serde(rename = "registrantId", skip_serializing_if = "Option::is_none")]
    registrant_id: Option<i64>,
    #[serde(rename = "registrantName")]
    registrant_name: String,
    #[serde(rename = "jurisdiction")]
    jurisdiction: String,
    #[serde(rename = "entityRole")]
    entity_role: String,
    #[serde(rename = "filingCount")]
    filing_count: usize,
    #[serde(rename = "clientCount")]
    client_count: usize,
    #[serde(rename = "reportedAmount")]
    reported_amount: f64,
    #[serde(rename = "reportedAmountLabel")]
    reported_amount_label: String,
    #[serde(rename = "topIssueAreas")]
    top_issue_areas: Vec<String>,
    #[serde(rename = "avatarText")]
    avatar_text: String,
}

#[derive(Deserialize)]
struct FilingsListParams {
    year: Option<u32>,
    q: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
}

async fn filings_list(
    State(state): State<Arc<AppState>>,
    params: Query<FilingsListParams>,
) -> Result<Json<FilingsListResponse>, (StatusCode, String)> {
    let client = state.lobbying.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Lobbying API not configured".to_string(),
        )
    })?;

    let year = params.year.unwrap_or(2026);
    let limit = params.limit.unwrap_or(10);
    let offset = params.offset.unwrap_or(0);
    let search = params.q.clone().unwrap_or_default().to_lowercase();

    let filings = fetch_filings_for_year(client, year, 1000).await?;

    let mut registrant_groups: HashMap<i64, (String, Vec<&lobbying_client::Filing>)> =
        HashMap::new();
    for filing in &filings {
        if let Some(ref reg) = filing.registrant {
            if let Some(id) = reg.id {
                let name = reg.name.clone().unwrap_or_else(|| "Unknown".to_string());
                registrant_groups
                    .entry(id)
                    .or_insert_with(|| (name, Vec::new()))
                    .1
                    .push(filing);
            }
        }
    }

    let mut cards: Vec<FilingCardItem> = registrant_groups
        .into_iter()
        .map(|(id, (name, group))| {
            let total_amount: f64 = group.iter().map(|f| reported_amount(f)).sum();
            let clients: HashSet<i64> = group
                .iter()
                .filter_map(|f| f.client.as_ref().and_then(|c| c.id))
                .collect();

            let mut issue_counts: HashMap<String, usize> = HashMap::new();
            for filing in &group {
                if let Some(ref activities) = filing.lobbying_activities {
                    for act in activities {
                        let display = act
                            .general_issue_code_display
                            .clone()
                            .unwrap_or_else(|| "Other".to_string());
                        *issue_counts.entry(display).or_insert(0) += 1;
                    }
                }
            }
            let mut top_issues: Vec<_> = issue_counts.into_iter().collect();
            top_issues.sort_by(|a, b| b.1.cmp(&a.1));
            let top_issue_areas: Vec<String> =
                top_issues.into_iter().take(5).map(|(k, _)| k).collect();

            let jurisdiction = group
                .first()
                .and_then(|f| f.registrant.as_ref())
                .and_then(|r| r.state_display.clone())
                .unwrap_or_else(|| "District of Columbia".to_string());

            FilingCardItem {
                registrant_id: Some(id),
                registrant_name: name.clone(),
                jurisdiction,
                entity_role: "Registrant".to_string(),
                filing_count: group.len(),
                client_count: clients.len(),
                reported_amount: total_amount,
                reported_amount_label: "Reported Amount".to_string(),
                top_issue_areas,
                avatar_text: initials(&name),
            }
        })
        .collect();

    cards.sort_by(|a, b| {
        b.reported_amount
            .partial_cmp(&a.reported_amount)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    if !search.is_empty() {
        cards.retain(|c| {
            c.registrant_name.to_lowercase().contains(&search)
                || c.top_issue_areas
                    .iter()
                    .any(|i| i.to_lowercase().contains(&search))
        });
    }

    let total = cards.len();
    let paged: Vec<_> = cards.into_iter().skip(offset).take(limit).collect();
    let has_more = offset + limit < total;

    Ok(Json(FilingsListResponse {
        items: paged,
        has_more,
    }))
}

// ── Influence flow endpoint ──

#[derive(Serialize)]
struct InfluenceFlowResponse {
    nodes: Vec<FlowNode>,
    links: Vec<FlowLink>,
}

#[derive(Serialize)]
struct FlowNode {
    id: String,
    label: String,
    side: String,
}

#[derive(Serialize)]
struct FlowLink {
    source: String,
    target: String,
    value: f64,
}

#[derive(Deserialize)]
struct InfluenceFlowParams {
    year: Option<u32>,
}

async fn influence_flow(
    State(state): State<Arc<AppState>>,
    params: Query<InfluenceFlowParams>,
) -> Result<Json<InfluenceFlowResponse>, (StatusCode, String)> {
    let client = state.lobbying.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Lobbying API not configured".to_string(),
        )
    })?;

    let year = params.year.unwrap_or(2026);
    let filings = fetch_filings_for_year(client, year, 500).await?;

    let mut spender_totals: HashMap<String, f64> = HashMap::new();
    let mut impact_totals: HashMap<String, f64> = HashMap::new();

    for filing in &filings {
        let amount = reported_amount(filing);

        let spender = classify_entity(filing);
        let issue_count = filing
            .lobbying_activities
            .as_ref()
            .map(|a| a.len().max(1))
            .unwrap_or(1) as f64;
        let allocated = amount / issue_count;

        *spender_totals.entry(spender).or_insert(0.0) += amount;

        if let Some(ref activities) = filing.lobbying_activities {
            for act in activities {
                let impact = classify_impact(act);
                *impact_totals.entry(impact).or_insert(0.0) += allocated;
            }
        } else {
            *impact_totals.entry("Policy".to_string()).or_insert(0.0) += amount;
        }
    }

    let nodes = vec![
        FlowNode {
            id: "corporations".to_string(),
            label: "Corporations".to_string(),
            side: "left".to_string(),
        },
        FlowNode {
            id: "lobbying_firms".to_string(),
            label: "Lobbying Firms".to_string(),
            side: "left".to_string(),
        },
        FlowNode {
            id: "associations".to_string(),
            label: "Associations".to_string(),
            side: "left".to_string(),
        },
        FlowNode {
            id: "other_spenders".to_string(),
            label: "Other".to_string(),
            side: "left".to_string(),
        },
        FlowNode {
            id: "senate_influence".to_string(),
            label: "Senate Influence".to_string(),
            side: "center".to_string(),
        },
        FlowNode {
            id: "legislation".to_string(),
            label: "Legislation".to_string(),
            side: "right".to_string(),
        },
        FlowNode {
            id: "policy".to_string(),
            label: "Policy".to_string(),
            side: "right".to_string(),
        },
        FlowNode {
            id: "regulation".to_string(),
            label: "Regulation".to_string(),
            side: "right".to_string(),
        },
        FlowNode {
            id: "appropriations".to_string(),
            label: "Appropriations".to_string(),
            side: "right".to_string(),
        },
    ];

    let mut links = Vec::new();
    for (spender, val) in &spender_totals {
        let source_id = match spender.as_str() {
            "Corporations" => "corporations",
            "Lobbying Firms" => "lobbying_firms",
            "Associations" => "associations",
            _ => "other_spenders",
        };
        links.push(FlowLink {
            source: source_id.to_string(),
            target: "senate_influence".to_string(),
            value: *val,
        });
    }
    for (impact, val) in &impact_totals {
        if *val > 0.0 {
            links.push(FlowLink {
                source: "senate_influence".to_string(),
                target: impact.to_lowercase().replace(' ', "_"),
                value: *val,
            });
        }
    }

    Ok(Json(InfluenceFlowResponse { nodes, links }))
}

fn classify_entity(filing: &lobbying_client::Filing) -> String {
    let registrant_name = filing
        .registrant
        .as_ref()
        .and_then(|r| r.name.as_deref())
        .unwrap_or("")
        .to_lowercase();
    let client_name = filing
        .client
        .as_ref()
        .and_then(|c| c.name.as_deref())
        .unwrap_or("")
        .to_lowercase();

    let names = format!("{} {}", registrant_name, client_name);

    if names.contains(" llp")
        || names.contains("llc")
        || names.contains("inc.")
        || names.contains(" inc ")
        || names.contains("corp.")
        || names.contains("corp ")
        || names.contains("corporation")
        || names.contains("ltd.")
        || names.contains("co.")
        || names.contains("company")
        || names.contains(" plc")
    {
        return "Corporations".to_string();
    }

    if registrant_name.contains("group")
        || registrant_name.contains("consult")
        || registrant_name.contains("strategies")
        || registrant_name.contains("advisors")
        || registrant_name.contains("partners")
        || registrant_name.contains("government affairs")
        || registrant_name.contains("public affairs")
        || registrant_name.contains("lobbying")
    {
        if names.contains(" association")
            || names.contains(" union")
            || names.contains(" institute")
            || names.contains("foundation")
            || names.contains("chamber")
            || names.contains("society")
            || names.contains("alliance")
            || names.contains("coalition")
        {
            return "Associations".to_string();
        }
        return "Lobbying Firms".to_string();
    }

    if names.contains(" association")
        || names.contains(" union")
        || names.contains(" institute")
        || names.contains("foundation")
        || names.contains("chamber")
        || names.contains("society")
        || names.contains("alliance")
        || names.contains("coalition")
        || names.contains("national ")
        || names.contains("american ")
    {
        return "Associations".to_string();
    }

    "Other".to_string()
}

fn classify_impact(activity: &LobbyingActivity) -> String {
    let desc = activity.description.as_deref().unwrap_or("").to_lowercase();
    let code = activity
        .general_issue_code_display
        .as_deref()
        .unwrap_or("")
        .to_lowercase();

    if desc.contains("h.r.")
        || desc.contains("s.")
        || desc.contains(" act")
        || desc.contains("amendment")
        || desc.contains("bill")
        || desc.contains("legislat")
        || code.contains("appropriations")
        || desc.contains("appropriat")
        || desc.contains("budget")
        || desc.contains("funding")
    {
        if desc.contains("appropriat") || desc.contains("budget") || desc.contains("funding") {
            return "Appropriations".to_string();
        }
        return "Legislation".to_string();
    }

    if let Some(ref gov_entities) = activity.government_entities {
        for entity in gov_entities {
            let ename = entity.name.as_deref().unwrap_or("").to_lowercase();
            if ename.contains("epa")
                || ename.contains("fcc")
                || ename.contains("ftc")
                || ename.contains("sec")
                || ename.contains("cms")
                || ename.contains("fda")
                || ename.contains("cfpb")
                || ename.contains("osha")
                || ename.contains("nh")
            {
                return "Regulation".to_string();
            }
        }
    }

    if desc.contains("regul")
        || desc.contains("rulemak")
        || desc.contains("executive order")
        || desc.contains("administrative")
        || desc.contains("oversight")
        || code.contains("reg")
        || code.contains("gov")
    {
        return "Regulation".to_string();
    }

    "Policy".to_string()
}

// ── Top sectors endpoint ──

#[derive(Serialize)]
struct TopSectorsResponse {
    year: u32,
    #[serde(rename = "allocationMethod")]
    allocation_method: String,
    items: Vec<SectorSpendItem>,
    #[serde(rename = "sourceNote")]
    source_note: String,
}

#[derive(Serialize)]
struct SectorSpendItem {
    sector: String,
    amount: f64,
    #[serde(rename = "filingCount")]
    filing_count: usize,
    #[serde(rename = "entityCount")]
    entity_count: usize,
}

#[derive(Deserialize)]
struct TopSectorsParams {
    year: Option<u32>,
    method: Option<String>,
}

async fn top_sectors(
    State(state): State<Arc<AppState>>,
    params: Query<TopSectorsParams>,
) -> Result<Json<TopSectorsResponse>, (StatusCode, String)> {
    let client = state.lobbying.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Lobbying API not configured".to_string(),
        )
    })?;

    let year = params.year.unwrap_or(2026);
    let method = params
        .method
        .clone()
        .unwrap_or_else(|| "even_split_by_issue".to_string());
    let filings = fetch_filings_for_year(client, year, 500).await?;

    let mut sector_amounts: HashMap<String, f64> = HashMap::new();
    let mut sector_filing_count: HashMap<String, usize> = HashMap::new();
    let mut sector_entities: HashMap<String, HashSet<String>> = HashMap::new();

    for filing in &filings {
        let amount = reported_amount(filing);
        let entity_name = filing
            .registrant
            .as_ref()
            .and_then(|r| r.name.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        let activities = filing.lobbying_activities.as_ref();
        let issue_count = activities.map(|a| a.len().max(1)).unwrap_or(1) as f64;
        let allocated_per_issue = if method == "even_split_by_issue" && amount > 0.0 {
            amount / issue_count
        } else {
            amount
        };

        if let Some(acts) = activities {
            for act in acts {
                let sector = map_issue_to_sector(act);
                *sector_amounts.entry(sector.clone()).or_insert(0.0) += allocated_per_issue;
                *sector_filing_count.entry(sector.clone()).or_insert(0) += 1;
                sector_entities
                    .entry(sector)
                    .or_default()
                    .insert(entity_name.clone());
            }
        }
    }

    let mut items: Vec<SectorSpendItem> = sector_amounts
        .into_iter()
        .map(|(sector, amount)| SectorSpendItem {
            entity_count: sector_entities.get(&sector).map(|s| s.len()).unwrap_or(0),
            filing_count: sector_filing_count.get(&sector).copied().unwrap_or(0),
            sector,
            amount,
        })
        .collect();

    items.sort_by(|a, b| {
        b.amount
            .partial_cmp(&a.amount)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(Json(TopSectorsResponse {
        year,
        allocation_method: method,
        items,
        source_note: "LDA filings; spend allocated evenly across disclosed issue areas."
            .to_string(),
    }))
}

fn map_issue_to_sector(activity: &LobbyingActivity) -> String {
    let code = activity
        .general_issue_code_display
        .as_deref()
        .unwrap_or("")
        .to_uppercase();

    if matches!(code.as_str(), "HCR" | "MMM" | "PHA" | "MED" | "HCF" | "HRT") {
        return "Health Care".to_string();
    }
    if matches!(
        code.as_str(),
        "FIN" | "BAN" | "INS" | "BNK" | "SEC" | "TAX" | "RET"
    ) {
        return "Finance & Insurance".to_string();
    }
    if matches!(
        code.as_str(),
        "ENG" | "ENV" | "FUE" | "OIL" | "NUC" | "NAT" | "UTY"
    ) {
        return "Energy & Natural Resources".to_string();
    }
    if matches!(
        code.as_str(),
        "TRA" | "AVI" | "AUT" | "RR" | "MAR" | "TRU" | "HWY"
    ) {
        return "Transportation".to_string();
    }
    if matches!(
        code.as_str(),
        "TEC" | "CPT" | "SCI" | "INT" | "TEL" | "AER" | "SPA"
    ) {
        return "Technology".to_string();
    }
    if matches!(
        code.as_str(),
        "DEF" | "HOM" | "VET" | "IMM" | "GOV" | "LAW" | "CIV" | "CRI" | "JUD" | "CON"
    ) {
        return "Government & Defense".to_string();
    }
    if matches!(code.as_str(), "AGR" | "FOD" | "BEV" | "TOB") {
        return "Agriculture & Food".to_string();
    }
    if matches!(code.as_str(), "TRD" | "FOR" | "INT") {
        return "Trade & Foreign Affairs".to_string();
    }
    if matches!(code.as_str(), "EDU" | "SPO" | "ART" | "HOU") {
        return "Education & Social".to_string();
    }
    if matches!(code.as_str(), "LBR" | "MAN" | "SMB") {
        return "Labor & Manufacturing".to_string();
    }
    if matches!(code.as_str(), "COM" | "MED" | "BRO") {
        return "Media & Communications".to_string();
    }

    let desc = activity.description.as_deref().unwrap_or("").to_lowercase();
    if desc.contains("health") || desc.contains("medic") || desc.contains("pharma") {
        return "Health Care".to_string();
    }
    if desc.contains("bank")
        || desc.contains("financ")
        || desc.contains("insur")
        || desc.contains("tax")
        || desc.contains("securit")
    {
        return "Finance & Insurance".to_string();
    }
    if desc.contains("energy")
        || desc.contains("oil")
        || desc.contains("gas")
        || desc.contains("fuel")
        || desc.contains("environment")
        || desc.contains("climate")
    {
        return "Energy & Natural Resources".to_string();
    }
    if desc.contains("transport")
        || desc.contains("aviation")
        || desc.contains("highway")
        || desc.contains("rail")
    {
        return "Transportation".to_string();
    }
    if desc.contains("tech")
        || desc.contains("software")
        || desc.contains("internet")
        || desc.contains("data")
        || desc.contains("ai ")
        || desc.contains("artificial")
    {
        return "Technology".to_string();
    }
    if desc.contains("defense")
        || desc.contains("military")
        || desc.contains("veteran")
        || desc.contains("immigration")
        || desc.contains("homeland")
    {
        return "Government & Defense".to_string();
    }
    if desc.contains("agriculture") || desc.contains("farm") || desc.contains("food") {
        return "Agriculture & Food".to_string();
    }
    if desc.contains("trade")
        || desc.contains("tariff")
        || desc.contains("export")
        || desc.contains("import")
    {
        return "Trade & Foreign Affairs".to_string();
    }
    if desc.contains("education")
        || desc.contains("school")
        || desc.contains("student")
        || desc.contains("housing")
    {
        return "Education & Social".to_string();
    }
    if desc.contains("labor")
        || desc.contains("worker")
        || desc.contains("manufactur")
        || desc.contains("small business")
    {
        return "Labor & Manufacturing".to_string();
    }
    if desc.contains("telecom")
        || desc.contains("broadband")
        || desc.contains("spectrum")
        || desc.contains("media")
    {
        return "Media & Communications".to_string();
    }

    "Other".to_string()
}
