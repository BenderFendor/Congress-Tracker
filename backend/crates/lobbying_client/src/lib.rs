//! U.S. Senate Lobbying Disclosure Act (LDA) REST API client.
//!
//! Based on the query interface and data cleaning patterns from
//! [lobbyR](https://github.com/Lobbying-DisclosuRe/lobbyr) (Chris Cioffi, LGPLv3)
//! and the API client design from
//! [lobby](https://github.com/christopherkenny/lobby) (Christopher Kenny).

mod error;
pub mod types;

pub use error::LobbyingError;
pub use types::{
    Client, ClientQuery, Contribution, ContributionQuery, Filing, FilingQuery, IssueJoiner,
    LobbyingActivity, Lobbyist, LobbyistQuery, PaginatedResponse, Registrant, RegistrantQuery,
};

/// The Senate LDA REST API base URL.
pub const LDA_API_BASE: &str = "https://lda.senate.gov/api/v1";

/// Client for the Senate Lobbying Disclosure Act (LDA) API.
///
/// Requires an API key obtained from <https://lda.senate.gov/api/register/>.
/// With a key, rate limit is 120 req/min. Without, it's 15 req/min.
pub struct LobbyingClient {
    client: reqwest::Client,
    api_key: Option<String>,
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
        })
    }

    /// Create a new client with an explicit API key.
    pub fn with_key(api_key: impl Into<String>) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: Some(api_key.into()),
        }
    }

    /// Create a client without authentication (15 req/min rate limit).
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: None,
        }
    }

    fn auth_header(&self) -> Option<String> {
        self.api_key.as_ref().map(|key| format!("Token {}", key))
    }

    /// List lobbying filings matching the query criteria.
    pub async fn get_filings(
        &self,
        query: &FilingQuery,
    ) -> Result<PaginatedResponse<Filing>, LobbyingError> {
        let url = format!("{}/filings/", LDA_API_BASE);
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
        let response: PaginatedResponse<Filing> = resp.json().await?;
        Ok(response)
    }

    /// Retrieve a single filing by UUID.
    pub async fn get_filing_by_id(&self, uuid: &str) -> Result<Filing, LobbyingError> {
        let url = format!("{}/filings/{}/", LDA_API_BASE, uuid);
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
        Ok(resp.json().await?)
    }

    /// List registrants (lobbying firms or self-filers).
    pub async fn get_registrants(
        &self,
        query: &RegistrantQuery,
    ) -> Result<PaginatedResponse<Registrant>, LobbyingError> {
        let url = format!("{}/registrants/", LDA_API_BASE);
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
        Ok(resp.json().await?)
    }

    /// List clients (organizations that hire lobbyists).
    pub async fn get_clients(
        &self,
        query: &ClientQuery,
    ) -> Result<PaginatedResponse<Client>, LobbyingError> {
        let url = format!("{}/clients/", LDA_API_BASE);
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
        Ok(resp.json().await?)
    }

    /// List lobbyists.
    pub async fn get_lobbyists(
        &self,
        query: &LobbyistQuery,
    ) -> Result<PaginatedResponse<Lobbyist>, LobbyingError> {
        let url = format!("{}/lobbyists/", LDA_API_BASE);
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
        Ok(resp.json().await?)
    }

    /// List contributions (LD-203 reports).
    pub async fn get_contributions(
        &self,
        query: &ContributionQuery,
    ) -> Result<PaginatedResponse<Contribution>, LobbyingError> {
        let url = format!("{}/contributions/", LDA_API_BASE);
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
        Ok(resp.json().await?)
    }
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
