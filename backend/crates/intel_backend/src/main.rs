use intel_backend::cache::CacheLayer;
use intel_backend::config::Config;
use intel_backend::db::Db;
use intel_backend::repository::Repository;
use intel_backend::routes;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = dotenvy::dotenv();
    intel_backend::tracing::init();
    let config = Config::from_env();

    if config.database_url.is_empty() {
        eprintln!("DATABASE_URL is required for intel_backend");
        std::process::exit(1);
    }

    let db = Db::connect(&config.database_url).await?;
    db.migrate().await?;

    let cache = Arc::new(CacheLayer::new(config.intel_cache_ttl_seconds));
    let repo = Repository::new(db, cache.clone());

    let app = routes::build_router(repo, cache, config.openfec_api_key);
    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Intel backend serving on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
