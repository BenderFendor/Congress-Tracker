/// Application configuration loaded from environment variables.

#[derive(Debug, Clone)]
pub struct Config {
    /// PostgreSQL connection string. Required for operation.
    pub database_url: String,
    /// TTL in seconds for the in-memory Moka response cache.
    pub intel_cache_ttl_seconds: u64,
    /// Congress.gov API key. May be empty for unauthenticated access.
    pub congress_gov_api_key: String,
    /// OpenFEC API key. May be empty (DEMO_KEY used at runtime).
    pub openfec_api_key: String,
    /// Base URL for the LDA lobbying disclosure API.
    pub lda_api_base_url: String,
    /// Optional Senate LDA API key.
    pub senate_lda_api_key: String,
    /// TCP port for the HTTP server.
    pub port: u16,
}

impl Config {
    /// Read configuration from environment variables with sensible defaults.
    ///
    /// Required:
    /// - `DATABASE_URL` — panics if missing (enforced at startup).
    ///
    /// Optional:
    /// - `PORT` — default `4020`
    /// - `INTEL_CACHE_TTL_SECONDS` — default `300`
    /// - `CONGRESS_GOV_API_KEY` — default `""`
    /// - `OPENFEC_API_KEY` — default `""`
    /// - `LDA_API_BASE_URL` — default `"https://lda.gov/api"`
    /// - `SENATE_LDA_API_KEY` — default `""`
    pub fn from_env() -> Self {
        Self {
            database_url: std::env::var("DATABASE_URL").unwrap_or_default(),
            intel_cache_ttl_seconds: std::env::var("INTEL_CACHE_TTL_SECONDS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(300),
            congress_gov_api_key: std::env::var("CONGRESS_GOV_API_KEY").unwrap_or_default(),
            openfec_api_key: std::env::var("OPENFEC_API_KEY").unwrap_or_default(),
            lda_api_base_url: std::env::var("LDA_API_BASE_URL")
                .unwrap_or_else(|_| "https://lda.gov/api".to_string()),
            senate_lda_api_key: std::env::var("SENATE_LDA_API_KEY").unwrap_or_default(),
            port: std::env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(4020),
        }
    }
}
