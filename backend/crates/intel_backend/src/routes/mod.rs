pub mod admin;
pub mod bills;
pub mod chambers;
pub mod committees;
pub mod fec;
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
pub mod trades;

use crate::cache::CacheLayer;
use crate::repository::Repository;
use axum::Router;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

pub fn build_router(repo: Repository, cache: Arc<CacheLayer>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Health
        .route("/api/health", axum::routing::get(health::health_check))
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
        // FEC (intel-backed)
        .route(
            "/api/intel/fec/candidates",
            axum::routing::get(fec::list_candidates),
        )
        .route(
            "/api/intel/fec/committees",
            axum::routing::get(fec::list_committees),
        )
        .route(
            "/api/elections/candidates",
            axum::routing::get(fec::list_candidates),
        )
        // Admin
        .route(
            "/api/admin/entity-resolution-queue",
            axum::routing::get(admin::get_resolution_queue),
        )
        // Layers
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(Arc::new(AppState { repo, cache }))
}

#[derive(Clone)]
pub struct AppState {
    pub repo: Repository,
    pub cache: Arc<CacheLayer>,
}
