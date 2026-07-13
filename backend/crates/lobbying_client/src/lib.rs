//! U.S. Senate Lobbying Disclosure Act (LDA) REST API client.
//!
//! Based on the query interface and data cleaning patterns from
//! [lobbyR](https://github.com/Lobbying-DisclosuRe/lobbyr) (Chris Cioffi, LGPLv3)
//! and the API client design from
//! [lobby](https://github.com/christopherkenny/lobby) (Christopher Kenny).

mod error;
pub mod types;

pub use error::LobbyingError;
use serde::de::DeserializeOwned;
pub use types::{
    Client, ClientQuery, Contribution, ContributionQuery, Filing, FilingQuery, IssueJoiner,
    LobbyingActivity, Lobbyist, LobbyistQuery, PaginatedResponse, Registrant, RegistrantQuery,
};

/// The Senate LDA REST API base URL.
pub const LDA_API_BASE: &str = "https://lda.gov/api/v1";

/// Client for the Senate Lobbying Disclosure Act (LDA) API.
///
/// Requires an API key obtained from <https://lda.senate.gov/api/register/>.
/// With a key, rate limit is 120 req/min. Without, it's 15 req/min.
pub struct LobbyingClient {
    client: reqwest::Client,
    api_key: Option<String>,
    base_url: String,
}

impl LobbyingClient {
    /// Create a new client from environment variable `SENATE_LDA_API_KEY`.
    pub fn from_env() -> Result<Self, LobbyingError> {
        let api_key = std::env::var("SENATE_LDA_API_KEY").ok();
        if api_key.is_none() {
            tracing::warn!(
                "SENATE_LDA_API_KEY not set — rate limited to 15 req/min. \
                 Get a key at https://lda.senate.gov/api/register/"
            );
        }
        Ok(Self {
            client: reqwest::Client::new(),
            api_key,
            base_url: configured_base_url(),
        })
    }

    /// Create a new client with an explicit API key.
    pub fn with_key(api_key: impl Into<String>) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: Some(api_key.into()),
            base_url: configured_base_url(),
        }
    }

    /// Create a client without authentication (15 req/min rate limit).
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: None,
            base_url: configured_base_url(),
        }
    }

    fn auth_header(&self) -> Option<String> {
        self.api_key.as_ref().map(|key| format!("Token {}", key))
    }

    fn endpoint(&self, path: &str) -> String {
        format!("{}/{}/", self.base_url, path.trim_matches('/'))
    }

    /// List lobbying filings matching the query criteria.
    pub async fn get_filings(
        &self,
        query: &FilingQuery,
    ) -> Result<PaginatedResponse<Filing>, LobbyingError> {
        let url = self.endpoint("filings");
        let mut req = self.client.get(&url);
        if let Some(ref auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        req = req.query(query);
        let resp = req.send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(LobbyingError::ApiError {
                status: status.as_u16(),
                body,
            });
        }
        Self::decode_json(resp).await
    }

    /// Retrieve a single filing by UUID.
    pub async fn get_filing_by_id(&self, uuid: &str) -> Result<Filing, LobbyingError> {
        let url = self.endpoint(&format!("filings/{uuid}"));
        let mut req = self.client.get(&url);
        if let Some(ref auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        let resp = req.send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(LobbyingError::ApiError {
                status: status.as_u16(),
                body,
            });
        }
        Self::decode_json(resp).await
    }

    /// List registrants (lobbying firms or self-filers).
    pub async fn get_registrants(
        &self,
        query: &RegistrantQuery,
    ) -> Result<PaginatedResponse<Registrant>, LobbyingError> {
        let url = self.endpoint("registrants");
        let mut req = self.client.get(&url);
        if let Some(ref auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        req = req.query(query);
        let resp = req.send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(LobbyingError::ApiError {
                status: status.as_u16(),
                body,
            });
        }
        Self::decode_json(resp).await
    }

    /// List clients (organizations that hire lobbyists).
    pub async fn get_clients(
        &self,
        query: &ClientQuery,
    ) -> Result<PaginatedResponse<Client>, LobbyingError> {
        let url = self.endpoint("clients");
        let mut req = self.client.get(&url);
        if let Some(ref auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        req = req.query(query);
        let resp = req.send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(LobbyingError::ApiError {
                status: status.as_u16(),
                body,
            });
        }
        Self::decode_json(resp).await
    }

    /// List lobbyists.
    pub async fn get_lobbyists(
        &self,
        query: &LobbyistQuery,
    ) -> Result<PaginatedResponse<Lobbyist>, LobbyingError> {
        let url = self.endpoint("lobbyists");
        let mut req = self.client.get(&url);
        if let Some(ref auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        req = req.query(query);
        let resp = req.send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(LobbyingError::ApiError {
                status: status.as_u16(),
                body,
            });
        }
        Self::decode_json(resp).await
    }

    /// List contributions (LD-203 reports).
    pub async fn get_contributions(
        &self,
        query: &ContributionQuery,
    ) -> Result<PaginatedResponse<Contribution>, LobbyingError> {
        let url = self.endpoint("contributions");
        let mut req = self.client.get(&url);
        if let Some(ref auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        req = req.query(query);
        let resp = req.send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(LobbyingError::ApiError {
                status: status.as_u16(),
                body,
            });
        }
        Self::decode_json(resp).await
    }

    async fn decode_json<T: DeserializeOwned>(resp: reqwest::Response) -> Result<T, LobbyingError> {
        let body = resp.text().await?;
        let mut deserializer = serde_json::Deserializer::from_str(&body);
        serde_path_to_error::deserialize(&mut deserializer).map_err(|err| LobbyingError::Decode {
            path: err.path().to_string(),
            message: err.inner().to_string(),
        })
    }
}

fn configured_base_url() -> String {
    std::env::var("LDA_API_BASE_URL")
        .unwrap_or_else(|_| LDA_API_BASE.to_string())
        .trim_end_matches('/')
        .to_string()
}

impl Default for LobbyingClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_construction_without_key() {
        let client = LobbyingClient::new();
        assert!(client.api_key.is_none());
        assert!(!client.base_url.ends_with('/'));
    }

    #[test]
    fn official_endpoint_keeps_the_required_v1_prefix() {
        let client = LobbyingClient {
            client: reqwest::Client::new(),
            api_key: None,
            base_url: LDA_API_BASE.to_string(),
        };
        assert_eq!(LDA_API_BASE, "https://lda.gov/api/v1");
        assert_eq!(
            client.endpoint("filings"),
            "https://lda.gov/api/v1/filings/"
        );
        assert_eq!(
            client.endpoint("/filings/example-uuid/"),
            "https://lda.gov/api/v1/filings/example-uuid/"
        );
    }

    #[test]
    fn test_client_construction_with_key() {
        let client = LobbyingClient::with_key("test-key-123");
        assert_eq!(client.api_key, Some("test-key-123".to_string()));
    }

    #[test]
    fn test_filing_query_builder() {
        let query = FilingQuery::default()
            .with_year(2024)
            .with_client("Test Corporation")
            .with_period("first_quarter");
        assert_eq!(query.filing_year, Some(2024));
        assert_eq!(query.client_name, Some("Test Corporation".to_string()));
        assert_eq!(query.filing_period, Some("first_quarter".to_string()));
    }

    #[test]
    fn test_issue_search_formatting() {
        let query = FilingQuery::default()
            .with_issues(&[
                "tax".to_string(),
                "energy".to_string(),
                "health".to_string(),
            ])
            .with_issue_joiner(IssueJoiner::Or);
        let issues = query.format_issues().unwrap();
        assert!(issues.contains("tax"));
        assert!(issues.contains(" OR "));
        assert!(issues.contains("energy"));
    }

    #[test]
    fn test_issue_search_formatting_and() {
        let query = FilingQuery::default()
            .with_issues_and_joiner(&["tax".to_string(), "energy".to_string()], IssueJoiner::And);
        let issues = query.format_issues().unwrap();
        assert!(issues.contains("+AND+"));
    }

    #[test]
    fn test_registrant_query_builder() {
        let query = RegistrantQuery::default()
            .with_name("Test Firm")
            .with_state("CA")
            .with_page(1);
        assert_eq!(query.registrant_name, Some("Test Firm".to_string()));
        assert_eq!(query.state, Some("CA".to_string()));
        assert_eq!(query.page, Some(1));
    }

    #[test]
    fn test_client_query_builder() {
        let query = ClientQuery::default()
            .with_name("Acme Corp")
            .with_country("US")
            .with_page_size(25);
        assert_eq!(query.client_name, Some("Acme Corp".to_string()));
        assert_eq!(query.country, Some("US".to_string()));
        assert_eq!(query.page_size, Some(25));
    }

    #[test]
    fn test_lobbyist_query_builder() {
        let query = LobbyistQuery::default()
            .with_name("Jane Doe")
            .with_state("NY");
        assert_eq!(query.lobbyist_name, Some("Jane Doe".to_string()));
        assert_eq!(query.state, Some("NY".to_string()));
    }

    #[test]
    fn test_contribution_query_builder() {
        let query = ContributionQuery::default()
            .with_year(2024)
            .with_filer_type("lobbyist")
            .with_registrant("Test Registrant");
        assert_eq!(query.filing_year, Some(2024));
        assert_eq!(query.filer_type, Some("lobbyist".to_string()));
        assert_eq!(query.registrant_name, Some("Test Registrant".to_string()));
    }
}
