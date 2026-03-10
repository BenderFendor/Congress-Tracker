use axum::{
    extract::State,
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

    let addr = SocketAddr::from(([127, 0, 0, 1], 4020));
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
            tracing::error!("Failed to fetch politicians: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch politicians: {:?}", e),
            ))
        }
    }
}

async fn get_trades(
    State(client): State<Arc<Client>>,
) -> Result<Json<PaginatedResponse<Trade>>, (StatusCode, String)> {
    let query = TradeQuery::default();
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