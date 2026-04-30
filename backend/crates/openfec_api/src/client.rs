use serde::de::DeserializeOwned;
use url::Url;

use crate::{
    query::{CandidateQuery, CommitteeQuery, Query, ReceiptQuery},
    types::{Candidate, Committee, PaginatedResponse, Receipt},
    Error,
};

pub struct Client {
    base_url: String,
    api_key: String,
}

impl Client {
    pub fn new(api_key: String) -> Self {
        let base_url = std::env::var("OPENFEC_API_BASE_URL")
            .unwrap_or_else(|_| "https://api.open.fec.gov".to_string());
        Self { base_url, api_key }
    }

    pub fn from_env() -> Result<Self, Error> {
        let api_key = std::env::var("OPENFEC_API_KEY")
            .map_err(|e| Error::Api(format!("OPENFEC_API_KEY not set: {}", e)))?;
        Ok(Self::new(api_key))
    }

    fn get_url(&self, path: &str, query: Option<&impl Query>) -> Result<Url, Error> {
        let mut url = Url::parse(&format!("{}{}", self.base_url, path))?;
        url.query_pairs_mut().append_pair("api_key", &self.api_key);
        if let Some(q) = query {
            q.add_to_url(&mut url);
        }
        Ok(url)
    }

    async fn get<T: DeserializeOwned>(&self, url: Url) -> Result<T, Error> {
        let client = reqwest::Client::new();
        let response = client.get(url).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(Error::Api(format!("HTTP {}: {}", status, text)));
        }

        let data: T = response.json().await?;
        Ok(data)
    }

    /// Get candidates filtered by query parameters
    pub async fn get_candidates(
        &self,
        query: &CandidateQuery,
    ) -> Result<PaginatedResponse<Candidate>, Error> {
        let url = self.get_url("/v1/candidates", Some(query))?;
        self.get(url).await
    }

    /// Get committees filtered by query parameters
    pub async fn get_committees(
        &self,
        query: &CommitteeQuery,
    ) -> Result<PaginatedResponse<Committee>, Error> {
        let url = self.get_url("/v1/committees", Some(query))?;
        self.get(url).await
    }

    /// Get receipts (donations) filtered by query parameters
    pub async fn get_receipts(
        &self,
        query: &ReceiptQuery,
    ) -> Result<PaginatedResponse<Receipt>, Error> {
        let url = self.get_url("/v1/schedules/schedule_a", Some(query))?;
        self.get(url).await
    }

    /// Get a specific candidate by ID
    pub async fn get_candidate_by_id(&self, candidate_id: &str) -> Result<Candidate, Error> {
        let url = self.get_url(
            &format!("/v1/candidates/{}", candidate_id),
            None::<&CandidateQuery>,
        )?;
        self.get(url).await
    }

    /// Get a specific committee by ID
    pub async fn get_committee_by_id(&self, committee_id: &str) -> Result<Committee, Error> {
        let url = self.get_url(
            &format!("/v1/committees/{}", committee_id),
            None::<&CommitteeQuery>,
        )?;
        self.get(url).await
    }
}
