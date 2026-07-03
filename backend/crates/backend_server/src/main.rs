use anomaly_scorer::{AnomalyScore, AnomalySignals};
use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use capitoltrades_api::{
    types::{PaginatedResponse as CapitolTradesPaginatedResponse, PoliticianDetail, Trade, TxType},
    Client as CapitolTradesClient, PoliticianQuery, Query as CapitolTradesQuery, TradeQuery,
};
use civiq_client::{Client as CiviqClient, RepresentativeQuery as CiviqQuery};
use congress_api::{
    types::{Bill, Member, PaginatedResponse as CongressPaginatedResponse},
    BillQuery, Client as CongressClient, MemberQuery, VoteQuery,
};
use lobbying_client::{
    ClientQuery, ContributionQuery, LobbyingClient, LobbyistQuery, RegistrantQuery,
};
use openfec_api::{
    types::{Candidate, PaginatedResponse as OpenFECPaginatedResponse, Receipt},
    CandidateQuery, Client as OpenFECClient, CommitteeQuery, ReceiptQuery,
};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

mod lobbying_analytics;
mod portfolio;
use trade_enricher::{compute_filer_metrics, EnrichedTrade, TradeType};

#[derive(serde::Deserialize)]
struct TradeParams {
    politician: Option<String>,
    #[serde(default)]
    size: Option<i64>,
    #[serde(default)]
    page: Option<i64>,
}

#[derive(serde::Deserialize)]
struct BillsParams {
    member: Option<String>,
    congress: Option<u32>,
}

#[derive(serde::Deserialize)]
struct MembersParams {
    state: Option<String>,
    district: Option<String>,
    chamber: Option<String>,
    party: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
}

#[derive(serde::Deserialize)]
struct LegislatorsParams {
    state: Option<String>,
    district: Option<String>,
    chamber: Option<String>,
    party: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
}

#[derive(serde::Deserialize)]
struct CandidatesParams {
    name: Option<String>,
    state: Option<String>,
}

#[derive(serde::Deserialize)]
struct ReceiptsParams {
    committee_id: Option<String>,
}

#[derive(serde::Deserialize)]
struct VotingParams {
    congress: Option<u32>,
    chamber: Option<String>,
    limit: Option<u32>,
}

#[derive(serde::Deserialize)]
struct EnrichmentParams {
    politician_id: Option<String>,
    limit: Option<u32>,
}

#[derive(serde::Deserialize)]
#[allow(dead_code)]
struct LobbyingFilingParams {
    client_name: Option<String>,
    registrant_name: Option<String>,
    year: Option<u32>,
    period: Option<String>,
    issue: Option<String>,
    page: Option<u32>,
    page_size: Option<u32>,
    with_posted_before: Option<String>,
    with_posted_after: Option<String>,
    with_amount_min: Option<String>,
    with_amount_max: Option<String>,
    with_issues: Option<String>,
}

#[derive(serde::Deserialize)]
#[allow(dead_code)]
struct CommitteeParams {
    committee_id: Option<String>,
}

#[derive(serde::Deserialize)]
#[allow(dead_code)]
struct AnomalyParams {
    limit: Option<u32>,
    member_id: Option<String>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // Initialize CapitolTrades client
    let capitoltrades_client = CapitolTradesClient::new();
    if let Err(e) = capitoltrades_client.prime_cookies().await {
        tracing::warn!("Failed to prime cookies, API requests might fail: {:?}", e);
    }

    // Initialize Congress.gov client from environment
    let congress_client = match CongressClient::from_env() {
        Ok(client) => {
            tracing::info!("Congress.gov API client initialized");
            Some(Arc::new(client))
        }
        Err(e) => {
            tracing::warn!("Failed to initialize Congress.gov client: {:?}", e);
            None
        }
    };

    // Initialize OpenFEC client from environment
    let openfec_client = match OpenFECClient::from_env() {
        Ok(client) => {
            tracing::info!("OpenFEC API client initialized");
            Some(Arc::new(client))
        }
        Err(e) => {
            tracing::warn!("Failed to initialize OpenFEC client: {:?}", e);
            None
        }
    };

    // Initialize Lobbying client from environment
    let lobbying_client = match LobbyingClient::from_env() {
        Ok(client) => {
            tracing::info!("Lobbying API client initialized");
            Some(Arc::new(client))
        }
        Err(e) => {
            tracing::warn!("Failed to initialize Lobbying client: {:?}", e);
            None
        }
    };

    let civiq_client = CiviqClient::new();
    tracing::info!("CIV.IQ API client initialized (free, no key)");

    // Initialize intel_backend (Postgres-backed intelligence layer)
    let intel_router = match std::env::var("DATABASE_URL") {
        Ok(db_url) if !db_url.is_empty() => {
            match intel_backend::Db::connect(&db_url).await {
                Ok(db) => {
                    if let Err(e) = db.migrate().await {
                        tracing::warn!("Intel backend migrations failed: {:?}", e);
                        None
                    } else {
                        let cache = std::sync::Arc::new(intel_backend::CacheLayer::new(
                            std::env::var("INTEL_CACHE_TTL_SECONDS")
                                .ok()
                                .and_then(|s| s.parse().ok())
                                .unwrap_or(300),
                        ));
                        let repo = intel_backend::Repository::new(db, cache.clone());
                        tracing::info!("Intel backend initialized with Postgres");
                        Some(intel_backend::routes::build_router(repo, cache))
                    }
                }
                Err(e) => {
                    tracing::warn!("Intel backend DB connection failed: {:?}. Falling back to pass-through mode.", e);
                    None
                }
            }
        }
        _ => {
            tracing::warn!(
                "DATABASE_URL not set. Running without Intel backend (pass-through mode)."
            );
            None
        }
    };

    let app_state = Arc::new(AppState {
        capitoltrades: Arc::new(capitoltrades_client),
        congress: congress_client,
        civiq: Arc::new(civiq_client),
        openfec: openfec_client,
        lobbying: lobbying_client,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // CapitolTrades endpoints (existing)
        .route("/api/politicians", get(get_politicians))
        .route("/api/trades", get(get_trades))
        // Congress.gov endpoints
        .route("/api/congress/bills", get(get_bills))
        .route("/api/congress/members", get(get_members))
        .route("/api/legislators", get(get_legislators))
        .route("/api/legislators/{id}", get(get_legislator_by_id))
        // OpenFEC endpoints
        .route("/api/fec/candidates", get(get_candidates))
        .route("/api/fec/receipts", get(get_receipts))
        // Enrichment endpoints
        .route("/api/enrichment/trades", get(get_enriched_trades))
        .route("/api/enrichment/member/{id}", get(get_enriched_member))
        .route("/api/enrichment/anomaly", get(get_anomaly_scores))
        // Lobbying endpoints
        .route("/api/lobbying/registrants", get(get_lobbying_registrants))
        .route("/api/lobbying/clients", get(get_lobbying_clients))
        .route("/api/lobbying/lobbyists", get(get_lobbying_lobbyists))
        .route(
            "/api/lobbying/contributions",
            get(get_lobbying_contributions),
        )
        .route(
            "/api/lobbying/filings/{uuid}",
            get(get_lobbying_filing_detail),
        )
        // Voting endpoint
        .route("/api/congress/votes", get(get_votes))
        // Committee endpoint
        .route("/api/fec/committees", get(get_committees))
        // Sector lookup
        .route("/api/enrichment/sectors", get(get_all_sectors))
        // Committee keywords
        .route(
            "/api/enrichment/committee-keywords",
            get(get_committee_keywords),
        )
        .merge(portfolio::routes())
        .merge(lobbying_analytics::routes())
        .layer(cors)
        .with_state(app_state);

    let legacy: Router = app;
    let intel: Router = intel_router.unwrap_or_else(Router::new);
    let app = legacy.merge(intel);
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(4020);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    tracing::info!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

struct AppState {
    capitoltrades: Arc<CapitolTradesClient>,
    congress: Option<Arc<CongressClient>>,
    civiq: Arc<CiviqClient>,
    openfec: Option<Arc<OpenFECClient>>,
    lobbying: Option<Arc<LobbyingClient>>,
}

#[derive(serde::Serialize, Clone)]
struct LegislatorTradeStats {
    count_trades: i64,
    count_issuers: i64,
    volume: i64,
    last_traded: Option<String>,
}

#[derive(serde::Serialize, Clone)]
struct LegislatorTradeSummary {
    politician_id: String,
    matched: bool,
    match_confidence: String,
    source: String,
    stats: LegislatorTradeStats,
}

#[derive(serde::Serialize, Clone)]
struct UnifiedLegislator {
    id: String,
    bioguide_id: String,
    name: String,
    first_name: String,
    last_name: String,
    party: String,
    state: String,
    district: String,
    chamber: String,
    avatar: String,
    bio: String,
    url: String,
    in_office: bool,
    next_election: String,
    trade_summary: Option<LegislatorTradeSummary>,
    committees: Vec<String>,
    bills_sponsored: u32,
}

use axum::http::StatusCode;

// CapitolTrades handlers (existing)
async fn get_politicians(
    State(state): State<Arc<AppState>>,
) -> Result<Json<CapitolTradesPaginatedResponse<PoliticianDetail>>, (StatusCode, String)> {
    let query = PoliticianQuery::default();
    match state.capitoltrades.get_politicians(&query).await {
        Ok(politicians) => Ok(Json(politicians)),
        Err(e) => {
            tracing::error!("Failed to fetch politicians: {:?}. Returning mock data.", e);
            let mock = CapitolTradesPaginatedResponse {
                data: vec![
                    PoliticianDetail {
                        politician_id: "A000360".to_string(),
                        state_id: Some("NC".to_string()),
                        party: Some(capitoltrades_api::types::Party::Democrat),
                        party_other: None,
                        district: Some("1".to_string()),
                        first_name: Some("Alma".to_string()),
                        last_name: Some("Adams".to_string()),
                        nickname: None,
                        middle_name: None,
                        full_name: "Alma Adams".to_string(),
                        dob: None,
                        gender: Some(capitoltrades_api::types::Gender::Female),
                        social_facebook: None,
                        social_twitter: None,
                        social_youtube: None,
                        website: None,
                        chamber: Some(capitoltrades_api::types::Chamber::House),
                        committees: vec![],
                        stats: capitoltrades_api::types::Stats {
                            date_last_traded: None,
                            count_trades: Some(12),
                            count_issuers: Some(5),
                            volume: Some(150000),
                        },
                    },
                    PoliticianDetail {
                        politician_id: "P000197".to_string(),
                        state_id: Some("CA".to_string()),
                        party: Some(capitoltrades_api::types::Party::Democrat),
                        party_other: None,
                        district: Some("11".to_string()),
                        first_name: Some("Nancy".to_string()),
                        last_name: Some("Pelosi".to_string()),
                        nickname: None,
                        middle_name: None,
                        full_name: "Nancy Pelosi".to_string(),
                        dob: None,
                        gender: Some(capitoltrades_api::types::Gender::Female),
                        social_facebook: None,
                        social_twitter: None,
                        social_youtube: None,
                        website: None,
                        chamber: Some(capitoltrades_api::types::Chamber::House),
                        committees: vec![],
                        stats: capitoltrades_api::types::Stats {
                            date_last_traded: None,
                            count_trades: Some(42),
                            count_issuers: Some(15),
                            volume: Some(12500000),
                        },
                    },
                ],
                meta: capitoltrades_api::types::Meta {
                    paging: capitoltrades_api::types::Paging {
                        page: 1,
                        size: 10,
                        total_items: 2,
                        total_pages: 1,
                    },
                },
            };
            Ok(Json(mock))
        }
    }
}

async fn get_trades(
    State(state): State<Arc<AppState>>,
    params: Query<TradeParams>,
) -> Result<Json<CapitolTradesPaginatedResponse<Trade>>, (StatusCode, String)> {
    let mut query = TradeQuery::default();
    if let Some(p) = &params.politician {
        query = query.with_politician_id(p.clone());
    }
    if let Some(s) = params.size {
        query = query.with_page_size(s);
    }
    if let Some(pg) = params.page {
        query = query.with_page(pg);
    }
    match state.capitoltrades.get_trades(&query).await {
        Ok(trades) => Ok(Json(trades)),
        Err(e) => {
            tracing::error!("Failed to fetch trades: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch trades: {:?}", e),
            ))
        }
    }
}

// Congress.gov handlers
async fn get_bills(
    State(state): State<Arc<AppState>>,
    params: Query<BillsParams>,
) -> Result<Json<CongressPaginatedResponse<Bill>>, (StatusCode, String)> {
    let client = state.congress.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Congress.gov API not configured".to_string(),
        )
    })?;

    let mut query = BillQuery::default();
    if let Some(member) = &params.member {
        query = query.with_member(member.clone());
    }
    if let Some(congress) = params.congress {
        query = query.with_congress(congress);
    }

    match client.get_bills(&query).await {
        Ok(bills) => Ok(Json(bills)),
        Err(e) => {
            tracing::error!("Failed to fetch bills: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch bills: {:?}", e),
            ))
        }
    }
}

async fn get_members(
    State(state): State<Arc<AppState>>,
    params: Query<MembersParams>,
) -> Result<Json<CongressPaginatedResponse<Member>>, (StatusCode, String)> {
    let client = state.congress.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Congress.gov API not configured".to_string(),
        )
    })?;

    let mut query = MemberQuery::default();
    if let Some(state_code) = &params.state {
        query = query.with_state(state_code.clone());
    }
    if let Some(district) = &params.district {
        query = query.with_district(district.clone());
    }
    if let Some(chamber) = &params.chamber {
        query = query.with_chamber(chamber.clone());
    }
    if let Some(party) = &params.party {
        query = query.with_party(party.clone());
    }
    if let Some(limit) = params.limit {
        query = query.with_limit(limit);
    }
    if let Some(offset) = params.offset {
        query = query.with_offset(offset);
    }

    match client.get_members(&query).await {
        Ok(members) => Ok(Json(members)),
        Err(e) => {
            tracing::error!("Failed to fetch members: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch members: {:?}", e),
            ))
        }
    }
}

async fn get_legislators(
    State(state): State<Arc<AppState>>,
    params: Query<LegislatorsParams>,
) -> Result<Json<CongressPaginatedResponse<UnifiedLegislator>>, (StatusCode, String)> {
    let trading_map = fetch_trading_map(&state.capitoltrades).await;

    // Try Congress.gov first, fall back to CIV.IQ
    if let Some(ref client) = state.congress {
        let mut query = MemberQuery::default();
        if let Some(state_code) = &params.state {
            query = query.with_state(state_code.clone());
        }
        if let Some(district) = &params.district {
            query = query.with_district(district.clone());
        }
        if let Some(chamber) = &params.chamber {
            query = query.with_chamber(chamber.clone());
        }
        if let Some(party) = &params.party {
            query = query.with_party(party.clone());
        }
        if let Some(limit) = params.limit {
            query = query.with_limit(limit);
        }
        if let Some(offset) = params.offset {
            query = query.with_offset(offset);
        }

        match client.get_members(&query).await {
            Ok(base) => {
                let legislators: Vec<_> = base
                    .data
                    .iter()
                    .map(|m| merge_legislator(m, &trading_map))
                    .collect();
                return Ok(Json(CongressPaginatedResponse {
                    data: legislators,
                    meta: base.meta,
                }));
            }
            Err(e) => tracing::warn!("Congress.gov failed, falling back to CIV.IQ: {:?}", e),
        }
    }

    // CIV.IQ fallback
    let mut query = CiviqQuery::new();
    if let Some(ref s) = params.state {
        query = query.with_state(s.clone());
    }
    if let Some(ref c) = params.chamber {
        query = query.with_chamber(c.clone());
    }
    if let Some(ref p) = params.party {
        query = query.with_party(p.clone());
    }
    if let Some(l) = params.limit {
        query = query.with_limit(l);
    }
    if let Some(o) = params.offset {
        query = query.with_offset(o);
    }

    let resp = state.civiq.get_representatives(&query).await.map_err(|e| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            format!("Failed to fetch legislators: {}", e),
        )
    })?;

    let legislators: Vec<UnifiedLegislator> = resp
        .data
        .iter()
        .map(|rep| {
            let (first_name, last_name) = split_member_name(&rep.name);
            let chamber = rep
                .chamber
                .clone()
                .unwrap_or_else(|| "Congress".to_string());
            let committees: Vec<String> = rep
                .committees
                .clone()
                .unwrap_or_default()
                .iter()
                .map(|c| c.name.clone())
                .collect();
            let trade_summary = trading_map
                .values()
                .find(|p| p.politician_id == rep.bioguide_id)
                .map(|politician| LegislatorTradeSummary {
                    politician_id: politician.politician_id.clone(),
                    matched: true,
                    match_confidence: "exact_id".to_string(),
                    source: "capitoltrades".to_string(),
                    stats: LegislatorTradeStats {
                        count_trades: politician.stats.count_trades.unwrap_or(0),
                        count_issuers: politician.stats.count_issuers.unwrap_or(0),
                        volume: politician.stats.volume.unwrap_or(0),
                        last_traded: politician.stats.date_last_traded.map(|d| d.to_string()),
                    },
                });
            UnifiedLegislator {
                id: rep.bioguide_id.clone(),
                bioguide_id: rep.bioguide_id.clone(),
                name: rep.name.clone(),
                first_name,
                last_name,
                party: rep.party.clone(),
                state: rep.state.clone(),
                district: rep.district.clone().unwrap_or_default(),
                chamber: chamber.clone(),
                avatar: build_avatar_url(&rep.bioguide_id),
                bio: format!(
                    "{} serves {}.",
                    rep.title.clone().unwrap_or_default(),
                    rep.state
                ),
                url: rep.website.clone().unwrap_or_default(),
                in_office: true,
                next_election: rep.next_election.clone().unwrap_or_default(),
                trade_summary,
                committees,
                bills_sponsored: 0,
            }
        })
        .collect();

    let total = resp
        .pagination
        .as_ref()
        .map(|p| p.total as u32)
        .unwrap_or(legislators.len() as u32);
    let pagination = congress_api::types::Pagination {
        count: total,
        next_url: resp.pagination.as_ref().map(|_| {
            format!(
                "/api/legislators?offset={}",
                params.offset.unwrap_or(0) + legislators.len() as u32
            )
        }),
        previous_url: None,
    };

    Ok(Json(CongressPaginatedResponse {
        data: legislators,
        meta: congress_api::types::Meta { pagination },
    }))
}

async fn get_legislator_by_id(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<UnifiedLegislator>, (StatusCode, String)> {
    // Try Congress.gov first, fall back to CIV.IQ (free, no key)
    let trading_map = fetch_trading_map(&state.capitoltrades).await;

    if let Some(ref client) = state.congress {
        match client.get_member_by_id(&id).await {
            Ok(member) => return Ok(Json(merge_legislator(&member, &trading_map))),
            Err(e) => tracing::warn!(
                "Congress.gov failed for {}: {:?}, falling back to CIV.IQ",
                id,
                e
            ),
        }
    }

    // CIV.IQ fallback (free, no API key required)
    let civiq_resp = state.civiq.get_representative(&id).await.map_err(|e| {
        tracing::error!("CIV.IQ also failed for {}: {:?}", id, e);
        (StatusCode::SERVICE_UNAVAILABLE, format!("All data sources failed for legislator {}. Get a Congress.gov key at https://api.congress.gov/sign-up", id))
    })?;

    let rep = civiq_resp.data;
    let (first_name, last_name) = split_member_name(&rep.name);
    let chamber = rep.chamber.unwrap_or_else(|| "Congress".to_string());
    let committees: Vec<String> = rep
        .committees
        .unwrap_or_default()
        .iter()
        .map(|c| c.name.clone())
        .collect();

    let trade_summary = trading_map
        .values()
        .find(|p| p.politician_id == rep.bioguide_id)
        .map(|politician| LegislatorTradeSummary {
            politician_id: politician.politician_id.clone(),
            matched: true,
            match_confidence: "exact_id".to_string(),
            source: "capitoltrades".to_string(),
            stats: LegislatorTradeStats {
                count_trades: politician.stats.count_trades.unwrap_or(0),
                count_issuers: politician.stats.count_issuers.unwrap_or(0),
                volume: politician.stats.volume.unwrap_or(0),
                last_traded: politician.stats.date_last_traded.map(|d| d.to_string()),
            },
        });

    Ok(Json(UnifiedLegislator {
        id: rep.bioguide_id.clone(),
        bioguide_id: rep.bioguide_id.clone(),
        name: rep.name.clone(),
        first_name,
        last_name,
        party: rep.party.clone(),
        state: rep.state.clone(),
        district: rep.district.unwrap_or_default(),
        chamber: chamber.clone(),
        avatar: build_avatar_url(&rep.bioguide_id),
        bio: format!(
            "{} serves {}.",
            rep.title.unwrap_or_else(|| if chamber == "Senate" {
                "Senator".to_string()
            } else {
                "Representative".to_string()
            }),
            rep.state
        ),
        url: rep
            .website
            .unwrap_or_else(|| rep.current_term.and_then(|t| t.website).unwrap_or_default()),
        in_office: true,
        next_election: rep.next_election.unwrap_or_default(),
        trade_summary,
        committees,
        bills_sponsored: 0,
    }))
}

fn normalize_name(value: &str) -> String {
    value
        .to_lowercase()
        .replace([',', '.'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn chamber_matches(
    congress_chamber: &str,
    cap_chamber: Option<capitoltrades_api::types::Chamber>,
) -> bool {
    match cap_chamber {
        Some(capitoltrades_api::types::Chamber::House) => {
            congress_chamber.eq_ignore_ascii_case("House")
        }
        Some(capitoltrades_api::types::Chamber::Senate) => {
            congress_chamber.eq_ignore_ascii_case("Senate")
        }
        None => true,
    }
}

fn build_avatar_url(bioguide_id: &str) -> String {
    format!(
        "https://theunitedstates.io/images/congress/225x275/{}.jpg",
        bioguide_id
    )
}

fn split_member_name(name: &str) -> (String, String) {
    if let Some((last, first)) = name.split_once(',') {
        return (first.trim().to_string(), last.trim().to_string());
    }

    let mut parts = name.split_whitespace().collect::<Vec<_>>();
    if parts.is_empty() {
        return (String::new(), String::new());
    }

    let last_name = parts.pop().unwrap_or_default().to_string();
    let first_name = parts.join(" ");
    (first_name, last_name)
}

fn match_confidence(member: &Member, politician: &PoliticianDetail) -> Option<String> {
    if politician.politician_id == member.bioguide_id {
        return Some("exact_id".to_string());
    }

    let (first_name, last_name) = split_member_name(&member.name);
    let member_name = normalize_name(&format!("{} {}", first_name, last_name));
    let politician_name = normalize_name(&politician.full_name);

    let state_match = politician
        .state_id
        .as_ref()
        .map(|state| state.eq_ignore_ascii_case(&member.state))
        .unwrap_or(false);
    let chamber = member
        .terms
        .as_ref()
        .and_then(|terms| terms.item.last())
        .map(|term| term.chamber.clone())
        .unwrap_or_else(|| "Congress".to_string());

    if member_name == politician_name
        && state_match
        && chamber_matches(&chamber, politician.chamber)
    {
        return Some("name_state_chamber".to_string());
    }

    None
}

async fn fetch_trading_map(client: &Arc<CapitolTradesClient>) -> HashMap<String, PoliticianDetail> {
    let query = PoliticianQuery::default().with_page_size(250);
    match client.get_politicians(&query).await {
        Ok(response) => response
            .data
            .into_iter()
            .map(|politician| (politician.politician_id.clone(), politician))
            .collect(),
        Err(error) => {
            tracing::warn!(
                "Failed to fetch CapitolTrades politicians for merge: {:?}",
                error
            );
            HashMap::new()
        }
    }
}

fn find_trade_match<'a>(
    member: &Member,
    trading_map: &'a HashMap<String, PoliticianDetail>,
) -> Option<(&'a PoliticianDetail, String)> {
    if let Some(politician) = trading_map.get(&member.bioguide_id) {
        return Some((politician, "exact_id".to_string()));
    }

    let candidates = trading_map
        .values()
        .filter_map(|politician| {
            match_confidence(member, politician).map(|confidence| (politician, confidence))
        })
        .collect::<Vec<_>>();

    if candidates.len() == 1 {
        return candidates.into_iter().next();
    }

    None
}

fn merge_legislator(
    member: &Member,
    trading_map: &HashMap<String, PoliticianDetail>,
) -> UnifiedLegislator {
    let (first_name, last_name) = split_member_name(&member.name);
    let chamber = member
        .terms
        .as_ref()
        .and_then(|terms| terms.item.last())
        .map(|term| term.chamber.clone())
        .unwrap_or_else(|| "Congress".to_string());

    let trade_summary = find_trade_match(member, trading_map).map(|(politician, confidence)| {
        let stats = &politician.stats;
        LegislatorTradeSummary {
            politician_id: politician.politician_id.clone(),
            matched: true,
            match_confidence: confidence,
            source: "capitoltrades".to_string(),
            stats: LegislatorTradeStats {
                count_trades: stats.count_trades.unwrap_or(0),
                count_issuers: stats.count_issuers.unwrap_or(0),
                volume: stats.volume.unwrap_or(0),
                last_traded: stats.date_last_traded.map(|date| date.to_string()),
            },
        }
    });

    let district = member
        .district
        .map(|value| value.to_string())
        .unwrap_or_default();
    let role = if chamber.eq_ignore_ascii_case("Senate") {
        "Senator"
    } else {
        "Representative"
    };

    UnifiedLegislator {
        id: member.bioguide_id.clone(),
        bioguide_id: member.bioguide_id.clone(),
        name: if first_name.is_empty() && last_name.is_empty() {
            member.name.clone()
        } else {
            format!("{} {}", first_name, last_name).trim().to_string()
        },
        first_name,
        last_name,
        party: member.party.clone(),
        state: member.state.clone(),
        district,
        chamber: chamber.clone(),
        avatar: build_avatar_url(&member.bioguide_id),
        bio: format!(
            "{} {} serves {}.",
            role,
            member.name.replace(',', ""),
            member.state
        ),
        url: member.url.clone().unwrap_or_default(),
        in_office: true,
        next_election: String::new(),
        trade_summary,
        committees: Vec::new(),
        bills_sponsored: 0,
    }
}

// Enrichment handlers

async fn get_enriched_trades(
    State(state): State<Arc<AppState>>,
    params: Query<EnrichmentParams>,
) -> Result<Json<Vec<EnrichedTrade>>, (StatusCode, String)> {
    let mut query = TradeQuery::default();
    if let Some(ref pid) = params.politician_id {
        query = query.with_politician_id(pid.clone());
    }
    if let Some(limit) = params.limit {
        query = query.with_page_size(limit as i64);
    }

    let trades_resp = state.capitoltrades.get_trades(&query).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to fetch trades: {:?}", e),
        )
    })?;

    let raw_trades: Vec<trade_enricher::RawTrade> = trades_resp
        .data
        .iter()
        .map(|trade| {
            let ticker = trade
                .issuer
                .issuer_ticker
                .clone()
                .or_else(|| trade.asset.as_ref().and_then(|a| a.asset_ticker.clone()))
                .unwrap_or_else(|| "N/A".to_string());
            let amount = match (trade.size_range_low, trade.size_range_high) {
                (Some(low), Some(high)) if low > 0 && high > 0 => {
                    format!("${} - ${}", low, high)
                }
                _ => format!("${} - ${}", trade.value, trade.value),
            };
            trade_enricher::RawTrade {
                ticker,
                asset_description: trade.issuer.issuer_name.clone(),
                trade_type: map_trade_type(&trade.tx_type),
                amount,
                trade_date: Some(trade.tx_date),
                disclosure_date: trade.filing_date,
                chamber: chamber_to_string(&trade.politician.chamber),
                politician_name: format!(
                    "{} {}",
                    trade.politician.first_name, trade.politician.last_name
                ),
                party: trade.politician.party.to_string(),
                state: trade.politician.state_id.clone(),
                district: None,
                owner: None,
                source_url: None,
                comment: None,
            }
        })
        .collect();

    let enriched: Vec<EnrichedTrade> = raw_trades
        .iter()
        .map(|raw| trade_enricher::enrich_trade(raw, &[]))
        .collect();

    Ok(Json(enriched))
}

async fn get_enriched_member(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let legislator =
        get_legislator_by_id(State(state.clone()), axum::extract::Path(id.clone())).await?;

    let query = TradeQuery::default()
        .with_politician_id(id.clone())
        .with_page_size(100);
    let trades = state.capitoltrades.get_trades(&query).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to fetch trades: {:?}", e),
        )
    })?;

    // Collect committees from trade data for conflict detection
    let committees: Vec<String> = {
        let mut cmtes: Vec<String> = Vec::new();
        for trade in &trades.data {
            for c in &trade.committees {
                if !cmtes.contains(c) {
                    cmtes.push(c.clone());
                }
            }
        }
        cmtes
    };

    let raw_trades: Vec<trade_enricher::RawTrade> = trades
        .data
        .iter()
        .map(|trade| {
            let ticker = trade
                .issuer
                .issuer_ticker
                .clone()
                .or_else(|| trade.asset.as_ref().and_then(|a| a.asset_ticker.clone()))
                .unwrap_or_else(|| "N/A".to_string());
            let amount = match (trade.size_range_low, trade.size_range_high) {
                (Some(low), Some(high)) if low > 0 && high > 0 => {
                    format!("${} - ${}", low, high)
                }
                _ => format!("${} - ${}", trade.value, trade.value),
            };
            trade_enricher::RawTrade {
                ticker,
                asset_description: trade.issuer.issuer_name.clone(),
                trade_type: map_trade_type(&trade.tx_type),
                amount,
                trade_date: Some(trade.tx_date),
                disclosure_date: trade.filing_date,
                chamber: chamber_to_string(&trade.politician.chamber),
                politician_name: legislator.0.name.clone(),
                party: legislator.0.party.clone(),
                state: legislator.0.state.clone(),
                district: Some(legislator.0.district.clone()).filter(|d| !d.is_empty()),
                owner: None,
                source_url: None,
                comment: None,
            }
        })
        .collect();

    let enriched_trades: Vec<EnrichedTrade> = raw_trades
        .iter()
        .map(|raw| trade_enricher::enrich_trade(raw, &committees))
        .collect();

    let metrics = compute_filer_metrics(&legislator.0.name, &enriched_trades);

    Ok(Json(serde_json::json!({
        "legislator": legislator.0,
        "metrics": metrics,
        "trades": enriched_trades,
    })))
}

async fn get_anomaly_scores(
    State(state): State<Arc<AppState>>,
    _params: Query<AnomalyParams>,
) -> Result<Json<Vec<AnomalyScore>>, (StatusCode, String)> {
    let politicos = state
        .capitoltrades
        .get_politicians(&PoliticianQuery::default().with_page_size(50))
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch politicians: {:?}", e),
            )
        })?;

    let mut scores: Vec<AnomalyScore> = Vec::new();

    for politician in politicos.data.into_iter() {
        let query = TradeQuery::default()
            .with_politician_id(politician.politician_id.clone())
            .with_page_size(100);

        if let Ok(trades_resp) = state.capitoltrades.get_trades(&query).await {
            let trade_count = trades_resp.data.len();
            if trade_count == 0 {
                continue;
            }

            let lagged = trades_resp
                .data
                .iter()
                .filter(|t| {
                    t.filing_date
                        .map(|fd| (fd - t.tx_date).num_days() > 45)
                        .unwrap_or(false)
                })
                .count();

            let timely = trades_resp
                .data
                .iter()
                .filter(|t| {
                    t.filing_date
                        .map(|fd| (fd - t.tx_date).num_days() <= 45)
                        .unwrap_or(false)
                })
                .count();

            let stock_timing =
                anomaly_scorer::compute_stock_timing_signal(trade_count - timely, trade_count);
            let attendance = anomaly_scorer::compute_attendance_signal(lagged, trade_count);

            let signals = AnomalySignals {
                stock_timing,
                wealth_gap: 50.0,
                donor_vote_alignment: 50.0,
                bill_authorship: 50.0,
                foreign_travel: 50.0,
                attendance,
            };

            let overall = anomaly_scorer::compute_anomaly_score(&signals);

            scores.push(AnomalyScore {
                member_identifier: politician.politician_id,
                member_name: politician.full_name,
                signals,
                overall_score: overall,
                percentile: None,
            });
        }
    }

    let scored = anomaly_scorer::score_all_members(scores);

    Ok(Json(scored))
}

// Lobbying handlers

async fn get_lobbying_registrants(
    State(state): State<Arc<AppState>>,
    params: Query<LobbyingFilingParams>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let client = state.lobbying.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Lobbying API not configured. Set SENATE_LDA_API_KEY.".to_string(),
        )
    })?;

    let mut query = RegistrantQuery::default();
    if let Some(ref name) = params.registrant_name {
        query = query.with_name(name.clone());
    }
    if let Some(page_size) = params.page_size {
        query = query.with_page_size(page_size);
    }
    if let Some(page) = params.page {
        query = query.with_page(page);
    }

    match client.get_registrants(&query).await {
        Ok(response) => Ok(Json(serde_json::json!({
            "count": response.count,
            "results": response.results,
        }))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("{:?}", e))),
    }
}

async fn get_lobbying_clients(
    State(state): State<Arc<AppState>>,
    params: Query<LobbyingFilingParams>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let client = state.lobbying.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Lobbying API not configured. Set SENATE_LDA_API_KEY.".to_string(),
        )
    })?;

    let mut query = ClientQuery::default();
    if let Some(ref name) = params.client_name {
        query = query.with_name(name.clone());
    }
    if let Some(page_size) = params.page_size {
        query = query.with_page_size(page_size);
    }
    if let Some(page) = params.page {
        query = query.with_page(page);
    }

    match client.get_clients(&query).await {
        Ok(response) => Ok(Json(serde_json::json!({
            "count": response.count,
            "results": response.results,
        }))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("{:?}", e))),
    }
}

async fn get_lobbying_lobbyists(
    State(state): State<Arc<AppState>>,
    params: Query<LobbyingFilingParams>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let client = state.lobbying.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Lobbying API not configured.".to_string(),
        )
    })?;

    let mut query = LobbyistQuery::default();
    if let Some(ref name) = params.registrant_name {
        query = query.with_name(name.clone());
    }
    if let Some(ref name) = params.client_name {
        query = query.with_name(name.clone());
    }
    if let Some(page_size) = params.page_size {
        query = query.with_page_size(page_size);
    }
    if let Some(page) = params.page {
        query = query.with_page(page);
    }

    match client.get_lobbyists(&query).await {
        Ok(response) => Ok(Json(serde_json::json!({
            "count": response.count,
            "results": response.results,
        }))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("{:?}", e))),
    }
}

async fn get_lobbying_contributions(
    State(state): State<Arc<AppState>>,
    params: Query<LobbyingFilingParams>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let client = state.lobbying.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Lobbying API not configured.".to_string(),
        )
    })?;

    let mut query = ContributionQuery::default();
    if let Some(year) = params.year {
        query = query.with_year(year);
    }
    if let Some(ref name) = params.client_name {
        query = query.with_registrant(name.clone());
    }
    if let Some(page_size) = params.page_size {
        query = query.with_page_size(page_size);
    }
    if let Some(page) = params.page {
        query = query.with_page(page);
    }

    match client.get_contributions(&query).await {
        Ok(response) => Ok(Json(serde_json::json!({
            "count": response.count,
            "results": response.results,
        }))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("{:?}", e))),
    }
}

async fn get_lobbying_filing_detail(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(uuid): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let client = state.lobbying.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Lobbying API not configured.".to_string(),
        )
    })?;

    match client.get_filing_by_id(&uuid).await {
        Ok(filing) => Ok(Json(serde_json::json!(filing))),
        Err(e) => Err((StatusCode::NOT_FOUND, format!("{:?}", e))),
    }
}

// Voting handler

async fn get_votes(
    State(state): State<Arc<AppState>>,
    params: Query<VotingParams>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let client = state.congress.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Congress.gov API not configured".to_string(),
        )
    })?;

    let mut query = VoteQuery::default();
    if let Some(congress) = params.congress {
        query = query.with_congress(congress);
    }
    if let Some(ref chamber) = params.chamber {
        query = query.with_chamber(chamber.clone());
    }
    if let Some(limit) = params.limit {
        query = query.with_limit(limit);
    }

    match client.get_votes(&query).await {
        Ok(votes) => Ok(Json(serde_json::json!({
            "votes": votes.data,
            "meta": votes.meta,
        }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to fetch votes: {:?}", e),
        )),
    }
}

// Committee handler

async fn get_committees(
    State(state): State<Arc<AppState>>,
    _params: Query<CommitteeParams>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let client = state.openfec.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "OpenFEC API not configured".to_string(),
        )
    })?;

    match client.get_committees(&CommitteeQuery::default()).await {
        Ok(committees) => Ok(Json(serde_json::json!({
            "committees": committees.data,
            "meta": committees.pagination,
        }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to fetch committees: {:?}", e),
        )),
    }
}

// Sector lookup handler

async fn get_all_sectors() -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let sectors: Vec<serde_json::Value> = ticker_resolver::all_sectors()
        .iter()
        .map(|sector| {
            let industries = ticker_resolver::industries_for_sector(sector);
            serde_json::json!({
                "sector": sector,
                "industries": industries,
            })
        })
        .collect();
    Ok(Json(serde_json::json!({ "sectors": sectors })))
}

async fn get_committee_keywords() -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let keywords: Vec<serde_json::Value> = committee_detector::all_committee_keywords()
        .iter()
        .map(|kw| {
            let sectors = committee_detector::sectors_for_committee(kw).unwrap_or(&[]);
            serde_json::json!({
                "keyword": kw,
                "sectors": sectors,
            })
        })
        .collect();
    Ok(Json(serde_json::json!({ "keywords": keywords })))
}

// Helper functions

fn map_trade_type(tx_type: &TxType) -> TradeType {
    match tx_type {
        TxType::Buy => TradeType::Buy,
        TxType::Sell => TradeType::Sell,
        TxType::Exchange => TradeType::Exchange,
        TxType::Receive => TradeType::Unknown,
    }
}

fn chamber_to_string(chamber: &capitoltrades_api::types::Chamber) -> String {
    match chamber {
        capitoltrades_api::types::Chamber::House => "house".to_string(),
        capitoltrades_api::types::Chamber::Senate => "senate".to_string(),
    }
}

// OpenFEC handlers
async fn get_candidates(
    State(state): State<Arc<AppState>>,
    params: Query<CandidatesParams>,
) -> Result<Json<OpenFECPaginatedResponse<Candidate>>, (StatusCode, String)> {
    let client = state.openfec.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "OpenFEC API not configured".to_string(),
        )
    })?;

    let mut query = CandidateQuery::default();
    if let Some(name) = &params.name {
        query = query.with_name(name.clone());
    }
    if let Some(state_code) = &params.state {
        query = query.with_state(state_code.clone());
    }

    match client.get_candidates(&query).await {
        Ok(candidates) => Ok(Json(candidates)),
        Err(e) => {
            tracing::error!("Failed to fetch candidates: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch candidates: {:?}", e),
            ))
        }
    }
}

async fn get_receipts(
    State(state): State<Arc<AppState>>,
    params: Query<ReceiptsParams>,
) -> Result<Json<OpenFECPaginatedResponse<Receipt>>, (StatusCode, String)> {
    let client = state.openfec.as_ref().ok_or_else(|| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "OpenFEC API not configured".to_string(),
        )
    })?;

    let mut query = ReceiptQuery::default();
    if let Some(committee_id) = &params.committee_id {
        query = query.with_committee_id(committee_id.clone());
    }

    match client.get_receipts(&query).await {
        Ok(receipts) => Ok(Json(receipts)),
        Err(e) => {
            tracing::error!("Failed to fetch receipts: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch receipts: {:?}", e),
            ))
        }
    }
}
