mod types;
pub use types::*;

use reqwest::Client as HttpClient;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("API error: {0}")]
    Api(String),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

pub struct Client {
    http: HttpClient,
    base_url: String,
}

impl Default for Client {
    fn default() -> Self {
        Self {
            http: HttpClient::new(),
            base_url: types::API_BASE.to_string(),
        }
    }
}

impl Client {
    pub fn new() -> Self {
        Self::default()
    }

    async fn get<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T, Error> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self.http.get(&url).send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(Error::Api(format!("HTTP {}: {}", status, body)));
        }
        Ok(resp.json().await?)
    }

    pub async fn get_representatives(
        &self,
        params: &RepresentativeQuery,
    ) -> Result<CiviqResponse<Vec<Representative>>, Error> {
        let qs = params.to_query_string();
        self.get(&format!("/representatives?{}", qs)).await
    }

    pub async fn get_representative(
        &self,
        bioguide_id: &str,
    ) -> Result<CiviqResponse<Representative>, Error> {
        self.get(&format!("/representatives/{}", bioguide_id)).await
    }

    pub async fn get_member_votes(
        &self,
        bioguide_id: &str,
        limit: u32,
    ) -> Result<CiviqResponse<Vec<VoteResult>>, Error> {
        self.get(&format!(
            "/representatives/{}/votes?limit={}",
            bioguide_id, limit
        ))
        .await
    }

    pub async fn get_vote(&self, vote_id: &str) -> Result<CiviqResponse<VoteResult>, Error> {
        self.get(&format!("/votes/{}", vote_id)).await
    }

    pub async fn get_bills(
        &self,
        limit: u32,
        offset: u32,
    ) -> Result<CiviqResponse<Vec<BillSummary>>, Error> {
        let qs = format!("limit={}&offset={}", limit, offset);
        self.get(&format!("/bills?{}", qs)).await
    }

    pub async fn get_bill(&self, bill_id: &str) -> Result<CiviqResponse<BillSummary>, Error> {
        self.get(&format!("/bills/{}", bill_id)).await
    }

    pub async fn get_committees(
        &self,
        chamber: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> Result<CiviqResponse<Vec<CiviqCommitteeListing>>, Error> {
        let mut qs = format!("limit={}&offset={}", limit, offset);
        if let Some(c) = chamber {
            qs.push_str(&format!("&chamber={}", c));
        }
        self.get(&format!("/committees?{}", qs)).await
    }
}

#[derive(Debug, Clone, Default)]
pub struct RepresentativeQuery {
    pub state: Option<String>,
    pub chamber: Option<String>,
    pub party: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

impl RepresentativeQuery {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn with_state(mut self, state: impl Into<String>) -> Self {
        self.state = Some(state.into());
        self
    }
    pub fn with_chamber(mut self, chamber: impl Into<String>) -> Self {
        self.chamber = Some(chamber.into());
        self
    }
    pub fn with_party(mut self, party: impl Into<String>) -> Self {
        self.party = Some(party.into());
        self
    }
    pub fn with_limit(mut self, limit: u32) -> Self {
        self.limit = Some(limit);
        self
    }
    pub fn with_offset(mut self, offset: u32) -> Self {
        self.offset = Some(offset);
        self
    }

    pub fn to_query_string(&self) -> String {
        let mut params = vec![];
        if let Some(ref s) = self.state {
            params.push(("state", s.clone()));
        }
        if let Some(ref c) = self.chamber {
            params.push(("chamber", c.clone()));
        }
        if let Some(ref p) = self.party {
            params.push(("party", p.clone()));
        }
        if let Some(l) = self.limit {
            params.push(("limit", l.to_string()));
        }
        if let Some(o) = self.offset {
            params.push(("offset", o.to_string()));
        }
        params
            .iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect::<Vec<_>>()
            .join("&")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_representatives() {
        let client = Client::new();
        let query = RepresentativeQuery::new()
            .with_chamber("house")
            .with_limit(2);
        let result = client.get_representatives(&query).await;
        assert!(result.is_ok());
        let resp = result.unwrap();
        assert!(!resp.data.is_empty());
    }

    #[tokio::test]
    async fn test_get_single_representative() {
        let client = Client::new();
        let result = client.get_representative("A000370").await;
        assert!(result.is_ok());
        let resp = result.unwrap();
        assert_eq!(resp.data.name, "Alma Adams");
    }

    #[tokio::test]
    async fn test_get_single_vote() {
        let client = Client::new();
        let result = client.get_vote("house-119-100").await;
        assert!(result.is_ok());
        let resp = result.unwrap();
        assert!(resp.data.positions.as_ref().is_some_and(|p| !p.is_empty()));
    }

    #[tokio::test]
    async fn test_get_bills() {
        let client = Client::new();
        let result = client.get_bills(2, 0).await;
        assert!(result.is_ok());
        let resp = result.unwrap();
        assert!(!resp.data.is_empty());
    }

    #[tokio::test]
    async fn test_get_committees() {
        let client = Client::new();
        let result = client.get_committees(None, 2, 0).await;
        assert!(result.is_ok());
        let resp = result.unwrap();
        assert!(!resp.data.is_empty());
    }

    #[test]
    fn test_query_builder() {
        let query = RepresentativeQuery::new()
            .with_state("NC")
            .with_chamber("House")
            .with_party("Democrat")
            .with_limit(50);
        let qs = query.to_query_string();
        assert!(qs.contains("state=NC"));
        assert!(qs.contains("chamber=House"));
    }
}
