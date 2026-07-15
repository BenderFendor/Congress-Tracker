pub mod bills;
pub mod candidates;
pub mod chambers;
pub mod committees;
pub mod fec;
pub mod financial;
pub mod funding;
pub mod health;
pub mod home;
pub mod influence;
pub mod lobbying;
pub mod member_intel;
pub mod members;
pub mod organizations;
pub mod portfolio;
pub mod search;
pub mod sources;
pub mod system;
pub mod trades;
pub mod visualizations;

use crate::cache::CacheLayer;
use crate::repository::Repository;
use axum::body::Body;
use axum::http::{header, HeaderName, HeaderValue, Request};
use axum::middleware::Next;
use axum::Extension;
use axum::Router;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tower_http::cors::{Any, CorsLayer};
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::{DefaultOnFailure, DefaultOnRequest, DefaultOnResponse, TraceLayer};
use tracing::Instrument;
use uuid::Uuid;

static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Middleware that ensures every request has an x-request-id header.
/// If the client provides one, it's used; otherwise a UUIDv4 is generated.
async fn correlation_id_middleware(
    mut request: Request<Body>,
    next: Next,
) -> axum::response::Response {
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            let count = REQUEST_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            format!(
                "{}-{}",
                Uuid::new_v4()
                    .to_string()
                    .split('-')
                    .next()
                    .unwrap_or("req"),
                count
            )
        });

    request.headers_mut().insert(
        HeaderName::from_static("x-request-id"),
        HeaderValue::from_str(&request_id).unwrap(),
    );

    let span = tracing::info_span!("request", request_id = %request_id);
    let response = next.run(request).instrument(span).await;
    response
}

/// Middleware that sets Cache-Control headers on public GET responses.
/// Per ADR 0003, all public GET routes emit cache-control with max-age
/// based on the route class (health=60s, lists=300s, detail=600s, viz=3600s).
async fn cache_control_middleware(request: Request<Body>, next: Next) -> axum::response::Response {
    let path = request.uri().path().to_string();
    let max_age = classify_cache_max_age(&path);

    let mut response = next.run(request).await;
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_str(&format!("public, max-age={max_age}")).unwrap(),
    );
    response
}

/// Middleware that limits concurrent request processing to 50 permits.
/// Acquires a permit from the shared semaphore before forwarding the request.
async fn concurrency_middleware(
    Extension(semaphore): Extension<Arc<Semaphore>>,
    request: Request<Body>,
    next: Next,
) -> axum::response::Response {
    let _permit = semaphore
        .acquire()
        .await
        .expect("concurrency semaphore closed");
    next.run(request).await
}

fn classify_cache_max_age(path: &str) -> u32 {
    // Exact match for /api/health
    if path == "/api/health" {
        return 60;
    }

    // System endpoints
    if path.starts_with("/api/system/") {
        return 60;
    }

    // Search
    if path == "/api/search" {
        return 60;
    }

    // Home
    if path.starts_with("/api/home/") {
        return 300;
    }

    // Sources
    if path.starts_with("/api/sources/") {
        return 300;
    }

    // Visualizations (precomputed aggregates)
    if path.starts_with("/api/visualizations/") {
        return 3600;
    }

    // Non-API or root — safe default
    if !path.starts_with("/api/") {
        return 300;
    }

    // Influence: /api/influence/networks (list) vs /api/influence/networks/:slug* (detail)
    if path == "/api/influence/networks" {
        return 300;
    }
    if path.starts_with("/api/influence/networks/") {
        return 600;
    }

    // Fixed list-only paths (no dynamic segment)
    if path == "/api/financial-snapshots" || path == "/api/senate-disclosures" {
        return 300;
    }

    // Known collection list paths (exact match = list, anything deeper = detail)
    let list_paths = [
        "/api/members",
        "/api/legislators",
        "/api/bills",
        "/api/committees",
        "/api/portfolios",
        "/api/relationships",
        "/api/lobbying/filings",
        "/api/lobbying/clients",
        "/api/lobbying/registrants",
        "/api/lobbying/lobbyists",
        "/api/intel/trades",
    ];
    if list_paths.contains(&path) {
        return 300;
    }

    // FEC and intel sub-paths are always list/collection
    if path.starts_with("/api/fec/") || path.starts_with("/api/intel/fec/") {
        return 300;
    }
    if path.starts_with("/api/intel/portfolio/") {
        return 300;
    }

    // Misc collection aliases
    if path == "/api/stocks/transactions" || path == "/api/elections/candidates" {
        return 300;
    }

    // Remaining /api/ paths are detail → 600
    600
}

pub fn build_router(repo: Repository, cache: Arc<CacheLayer>) -> Router {
    let semaphore = Arc::new(Semaphore::new(50));
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Health
        .route("/api/health", axum::routing::get(health::health_check))
        .route(
            "/api/system/disclosure-coverage",
            axum::routing::get(system::coverage),
        )
        .route(
            "/api/financial-snapshots",
            axum::routing::get(financial::list_financial_snapshots),
        )
        .route(
            "/api/senate-disclosures",
            axum::routing::get(financial::list_senate_disclosures),
        )
        .route(
            "/api/system/worker-health",
            axum::routing::get(system::worker_health),
        )
        .route("/api/home/summary", axum::routing::get(home::summary))
        .route("/api/sources/status", axum::routing::get(sources::status))
        .route(
            "/api/sources/coverage",
            axum::routing::get(sources::coverage),
        )
        // Members
        .route(
            "/api/legislators",
            axum::routing::get(members::list_members),
        )
        .route(
            "/api/legislators/:bioguide_id",
            axum::routing::get(members::get_member_profile),
        )
        .route(
            "/api/members/:bioguide_id/profile",
            axum::routing::get(members::get_member_profile),
        )
        .route("/api/members", axum::routing::get(members::list_members))
        .route(
            "/api/members/:bioguide_id/votes",
            axum::routing::get(member_intel::get_member_votes),
        )
        .route(
            "/api/members/:bioguide_id/legislation",
            axum::routing::get(member_intel::get_member_legislation),
        )
        .route(
            "/api/members/:bioguide_id/disclosures",
            axum::routing::get(organizations::get_member_disclosures),
        )
        // Bills
        .route("/api/bills", axum::routing::get(bills::list_bills))
        .route(
            "/api/bills/:bill_id",
            axum::routing::get(bills::get_bill_by_id),
        )
        .route(
            "/api/bills/:congress/:bill_type/:bill_number/intel",
            axum::routing::get(bills::get_bill_intel),
        )
        .route(
            "/api/bills/:congress/:bill_type/:bill_number/amendments",
            axum::routing::get(bills::get_bill_amendments),
        )
        // Funding
        .route(
            "/api/members/:bioguide_id/funding",
            axum::routing::get(funding::get_member_funding),
        )
        // Influence
        .route(
            "/api/influence/networks",
            axum::routing::get(influence::list_networks),
        )
        .route(
            "/api/influence/networks/:network_slug",
            axum::routing::get(influence::get_network),
        )
        .route(
            "/api/influence/networks/:network_slug/financials",
            axum::routing::get(influence::get_network_financials),
        )
        // Committees
        .route(
            "/api/committees",
            axum::routing::get(committees::list_committees),
        )
        .route(
            "/api/committees/:committee_id",
            axum::routing::get(committees::get_committee),
        )
        // Chambers
        .route(
            "/api/chambers/:chamber/dashboard",
            axum::routing::get(chambers::get_dashboard),
        )
        // Search
        // Trades
        .route("/api/intel/trades", axum::routing::get(trades::list_trades))
        .route(
            "/api/intel/trades/:ticker",
            axum::routing::get(trades::trades_by_ticker),
        )
        .route(
            "/api/stocks/transactions",
            axum::routing::get(trades::list_trades),
        )
        .route(
            "/api/members/:member_id/trades",
            axum::routing::get(trades::member_trades),
        )
        .route(
            "/api/intel/portfolio/summary",
            axum::routing::get(portfolio::summary),
        )
        .route(
            "/api/intel/portfolio/members",
            axum::routing::get(portfolio::members),
        )
        .route(
            "/api/intel/portfolio/sectors",
            axum::routing::get(portfolio::sectors),
        )
        .route(
            "/api/intel/portfolio/pulse",
            axum::routing::get(portfolio::pulse),
        )
        .route("/api/portfolios", axum::routing::get(portfolio::members))
        .route("/api/search", axum::routing::get(search::search))
        .route(
            "/api/relationships",
            axum::routing::get(organizations::list_relationships),
        )
        .route(
            "/api/organizations/:organization_id",
            axum::routing::get(organizations::get_organization),
        )
        // Lobbying
        .route(
            "/api/lobbying/filings",
            axum::routing::get(lobbying::list_filings),
        )
        .route(
            "/api/lobbying/filings/:id",
            axum::routing::get(lobbying::get_filing),
        )
        .route(
            "/api/lobbying/clients",
            axum::routing::get(lobbying::list_clients),
        )
        .route(
            "/api/lobbying/clients/:id",
            axum::routing::get(lobbying::get_client),
        )
        .route(
            "/api/lobbying/registrants",
            axum::routing::get(lobbying::list_registrants),
        )
        .route(
            "/api/lobbying/registrants/:id",
            axum::routing::get(lobbying::get_registrant),
        )
        .route(
            "/api/lobbying/lobbyists",
            axum::routing::get(lobbying::list_lobbyists),
        )
        .route(
            "/api/lobbying/lobbyists/:id",
            axum::routing::get(lobbying::get_lobbyist),
        )
        // Visualizations
        .route(
            "/api/visualizations/campaign-finance",
            axum::routing::get(visualizations::campaign_finance),
        )
        // FEC (intel-backed)
        .route(
            "/api/intel/fec/candidates",
            axum::routing::get(fec::list_candidates),
        )
        .route(
            "/api/intel/fec/committees",
            axum::routing::get(fec::list_committees),
        )
        .route("/api/fec/receipts", axum::routing::get(fec::list_receipts))
        .route(
            "/api/fec/disbursements",
            axum::routing::get(fec::list_disbursements),
        )
        .route(
            "/api/intel/fec/receipts",
            axum::routing::get(fec::list_receipts),
        )
        .route(
            "/api/elections/candidates",
            axum::routing::get(fec::list_candidates),
        )
        .route(
            "/api/elections/candidates/:candidate_id",
            axum::routing::get(candidates::get_candidate),
        )
        // Layers
        .layer(
            TraceLayer::new_for_http()
                .on_request(DefaultOnRequest::new().level(tracing::Level::INFO))
                .on_response(DefaultOnResponse::new().level(tracing::Level::INFO))
                .on_failure(DefaultOnFailure::new().level(tracing::Level::WARN))
                .make_span_with(|request: &Request<_>| {
                    let method = request.method().to_string();
                    let uri = request.uri().path().to_string();
                    let request_id = request
                        .headers()
                        .get("x-request-id")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("unknown");
                    tracing::info_span!(
                        "http_request",
                        method = %method,
                        uri = %uri,
                        request_id = %request_id,
                        status = tracing::field::Empty,
                        latency_ms = tracing::field::Empty,
                    )
                }),
        )
        .layer(TimeoutLayer::new(Duration::from_secs(30)))
        .layer(axum::middleware::from_fn(correlation_id_middleware))
        .layer(axum::middleware::from_fn(concurrency_middleware))
        .layer(axum::Extension(semaphore.clone()))
        .layer(axum::middleware::from_fn(cache_control_middleware))
        .layer(cors)
        .with_state(Arc::new(AppState {
            repo,
            cache,
            concurrency: semaphore,
        }))
}

#[derive(Clone)]
pub struct AppState {
    pub repo: Repository,
    pub cache: Arc<CacheLayer>,
    pub concurrency: Arc<Semaphore>,
}
