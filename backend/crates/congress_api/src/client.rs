use serde::de::DeserializeOwned;
use url::Url;

use crate::{
    query::{BillQuery, MemberQuery, Query, VoteQuery},
    types::{
        Bill, BillsResponse, Member, MembersResponse, Meta, PaginatedResponse, Vote, VotesResponse,
    },
    Error,
};

pub struct Client {
    base_url: String,
    api_key: String,
}

impl Client {
    pub fn new(api_key: String) -> Self {
        let base_url = std::env::var("CONGRESS_GOV_API_BASE_URL")
            .unwrap_or_else(|_| "https://api.congress.gov".to_string());
        Self { base_url, api_key }
    }

    pub fn from_env() -> Result<Self, Error> {
        let api_key = std::env::var("CONGRESS_GOV_API_KEY")
            .map_err(|e| Error::Api(format!("CONGRESS_GOV_API_KEY not set: {}", e)))?;
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
            if text.contains("API_KEY_INVALID") || status.as_u16() == 403 {
                return Err(Error::Api(format!(
                    "Congress.gov API key is invalid or expired. \
                     Get a free key at https://api.congress.gov/sign-up and set CONGRESS_GOV_API_KEY in .env. \
                     (HTTP {}: {})",
                    status, text
                )));
            }
            return Err(Error::Api(format!("HTTP {}: {}", status, text)));
        }

        let data: T = response.json().await?;
        Ok(data)
    }

    /// Get bills filtered by query parameters
    pub async fn get_bills(&self, query: &BillQuery) -> Result<PaginatedResponse<Bill>, Error> {
        let url = self.get_url("/v3/bill", Some(query))?;
        let response: BillsResponse = self.get(url).await?;
        Ok(PaginatedResponse {
            data: response.bills,
            meta: Meta {
                pagination: response.pagination,
            },
        })
    }

    /// Get members filtered by query parameters
    pub async fn get_members(
        &self,
        query: &MemberQuery,
    ) -> Result<PaginatedResponse<Member>, Error> {
        let url = self.get_url("/v3/member", Some(query))?;
        let response: MembersResponse = self.get(url).await?;
        Ok(PaginatedResponse {
            data: response.members,
            meta: Meta {
                pagination: response.pagination,
            },
        })
    }

    /// Get votes filtered by query parameters
    pub async fn get_votes(&self, query: &VoteQuery) -> Result<PaginatedResponse<Vote>, Error> {
        let url = self.get_url("/v3/vote", Some(query))?;
        let response: VotesResponse = self.get(url).await?;
        Ok(PaginatedResponse {
            data: response.votes,
            meta: Meta {
                pagination: response.pagination,
            },
        })
    }

    /// Get a specific member by bioguide ID
    pub async fn get_member_by_id(&self, bioguide_id: &str) -> Result<Member, Error> {
        let url = self.get_url(&format!("/v3/member/{}", bioguide_id), None::<&MemberQuery>)?;
        self.get(url).await
    }
}
