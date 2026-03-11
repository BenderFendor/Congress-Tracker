use axum::{
    extract::{State, Query},
    routing::get,
    Json, Router,
};
use capitoltrades_api::{
    Client as CapitolTradesClient,
    PoliticianQuery,
    TradeQuery,
    types::{PaginatedResponse as CapitolTradesPaginatedResponse, PoliticianDetail, Trade},
};
use congress_api::{
    Client as CongressClient,
    BillQuery,
    MemberQuery,
    types::{PaginatedResponse as CongressPaginatedResponse, Bill, Member},
};
use openfec_api::{
    Client as OpenFECClient,
    CandidateQuery,
    ReceiptQuery,
    types::{PaginatedResponse as OpenFECPaginatedResponse, Candidate, Receipt},
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

#[derive(serde::Deserialize)]
struct TradeParams {
    politician: Option<String>,
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

    let app_state = Arc::new(AppState {
        capitoltrades: Arc::new(capitoltrades_client),
        congress: congress_client,
        openfec: openfec_client,
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
        // OpenFEC endpoints
        .route("/api/fec/candidates", get(get_candidates))
        .route("/api/fec/receipts", get(get_receipts))
        .layer(cors)
        .with_state(app_state);

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
    openfec: Option<Arc<OpenFECClient>>,
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
                    }
                ],
                meta: capitoltrades_api::types::Meta {
                    paging: capitoltrades_api::types::Paging {
                        page: 1,
                        size: 10,
                        total_items: 2,
                        total_pages: 1,
                    }
                }
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
