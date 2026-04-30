#[derive(Debug, thiserror::Error)]
pub enum LobbyingError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("API error {status}: {body}")]
    ApiError { status: u16, body: String },

    #[error("API key not configured. Set SENATE_LDA_API_KEY env var or get one at https://lda.senate.gov/api/register/")]
    NoApiKey,

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}
