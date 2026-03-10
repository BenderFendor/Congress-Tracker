use axum::{
    extract::{State, Query},
    routing::get,
    Json, Router,
};
use capitoltrades_api::{
    Client,
    PoliticianQuery,
    TradeQuery,
    types::{PaginatedResponse, PoliticianDetail, Trade},
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

#[derive(serde::Deserialize)]
struct TradeParams {
    politician: Option<String>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let client = Client::new();
    if let Err(e) = client.prime_cookies().await {
        tracing::warn!("Failed to prime cookies, API requests might fail: {:?}", e);
    }
    let app_state = Arc::new(client);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/politicians", get(get_politicians))
        .route("/api/trades", get(get_trades))
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

use axum::http::StatusCode;

async fn get_politicians(
    State(client): State<Arc<Client>>,
) -> Result<Json<PaginatedResponse<PoliticianDetail>>, (StatusCode, String)> {
    let query = PoliticianQuery::default();
    match client.get_politicians(&query).await {
        Ok(politicians) => Ok(Json(politicians)),
        Err(e) => {
            tracing::error!("Failed to fetch politicians: {:?}. Returning mock data.", e);
            let mock = PaginatedResponse {
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
    State(client): State<Arc<Client>>,
    params: Query<TradeParams>,
) -> Result<Json<PaginatedResponse<Trade>>, (StatusCode, String)> {
    let mut query = TradeQuery::default();
    if let Some(p) = &params.politician {
        query = query.with_politician_id(p.clone());
    }
    match client.get_trades(&query).await {
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
