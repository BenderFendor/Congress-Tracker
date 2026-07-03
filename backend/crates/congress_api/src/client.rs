use serde::de::DeserializeOwned;
use url::Url;

use crate::{
    query::{BillQuery, MemberQuery, Query, VoteQuery},
    types::{
        Bill, BillActionsResponse, BillAmendmentsResponse, BillCosponsorsResponse, BillDetail,
        BillSubjectsResponse, BillSummariesResponse, BillTextResponse, BillsResponse, Member,
        MemberCosponsoredResponse, MemberSponsoredResponse, MembersResponse, Meta,
        PaginatedResponse, Vote, VotePositionsResponse, VotesResponse,
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

    /// Get a specific bill by congress, type, and number
    pub async fn get_bill_detail(
        &self,
        congress: u32,
        bill_type: &str,
        bill_number: u32,
    ) -> Result<BillDetail, Error> {
        let path = format!("/v3/bill/{}/{}/{}", congress, bill_type, bill_number);
        let url = self.get_url(&path, None::<&BillQuery>)?;
        self.get(url).await
    }

    /// Get bill actions
    pub async fn get_bill_actions(
        &self,
        congress: u32,
        bill_type: &str,
        bill_number: u32,
    ) -> Result<BillActionsResponse, Error> {
        let path = format!(
            "/v3/bill/{}/{}/{}/actions",
            congress, bill_type, bill_number
        );
        let url = self.get_url(&path, None::<&BillQuery>)?;
        self.get(url).await
    }

    /// Get bill cosponsors
    pub async fn get_bill_cosponsors(
        &self,
        congress: u32,
        bill_type: &str,
        bill_number: u32,
    ) -> Result<BillCosponsorsResponse, Error> {
        let path = format!(
            "/v3/bill/{}/{}/{}/cosponsors",
            congress, bill_type, bill_number
        );
        let url = self.get_url(&path, None::<&BillQuery>)?;
        self.get(url).await
    }

    /// Get bill subjects
    pub async fn get_bill_subjects(
        &self,
        congress: u32,
        bill_type: &str,
        bill_number: u32,
    ) -> Result<BillSubjectsResponse, Error> {
        let path = format!(
            "/v3/bill/{}/{}/{}/subjects",
            congress, bill_type, bill_number
        );
        let url = self.get_url(&path, None::<&BillQuery>)?;
        self.get(url).await
    }

    /// Get bill summaries
    pub async fn get_bill_summaries(
        &self,
        congress: u32,
        bill_type: &str,
        bill_number: u32,
    ) -> Result<BillSummariesResponse, Error> {
        let path = format!(
            "/v3/bill/{}/{}/{}/summaries",
            congress, bill_type, bill_number
        );
        let url = self.get_url(&path, None::<&BillQuery>)?;
        self.get(url).await
    }

    /// Get bill text versions
    pub async fn get_bill_text(
        &self,
        congress: u32,
        bill_type: &str,
        bill_number: u32,
    ) -> Result<BillTextResponse, Error> {
        let path = format!("/v3/bill/{}/{}/{}/text", congress, bill_type, bill_number);
        let url = self.get_url(&path, None::<&BillQuery>)?;
        self.get(url).await
    }

    /// Get bill amendments
    pub async fn get_bill_amendments(
        &self,
        congress: u32,
        bill_type: &str,
        bill_number: u32,
    ) -> Result<BillAmendmentsResponse, Error> {
        let path = format!(
            "/v3/bill/{}/{}/{}/amendments",
            congress, bill_type, bill_number
        );
        let url = self.get_url(&path, None::<&BillQuery>)?;
        self.get(url).await
    }

    /// Get member's sponsored legislation
    pub async fn get_member_sponsored_legislation(
        &self,
        bioguide_id: &str,
    ) -> Result<MemberSponsoredResponse, Error> {
        let path = format!("/v3/member/{}/sponsored-legislation", bioguide_id);
        let url = self.get_url(&path, None::<&BillQuery>)?;
        self.get(url).await
    }

    /// Get member's cosponsored legislation
    pub async fn get_member_cosponsored_legislation(
        &self,
        bioguide_id: &str,
    ) -> Result<MemberCosponsoredResponse, Error> {
        let path = format!("/v3/member/{}/cosponsored-legislation", bioguide_id);
        let url = self.get_url(&path, None::<&BillQuery>)?;
        self.get(url).await
    }

    /// Get vote positions (member-level votes on a roll call)
    pub async fn get_vote_positions(
        &self,
        congress: u32,
        chamber: &str,
        session: u32,
        roll_number: u32,
    ) -> Result<VotePositionsResponse, Error> {
        let path = format!(
            "/v3/vote/{}/{}/{}/{}",
            congress, chamber, session, roll_number
        );
        let url = self.get_url(&path, None::<&BillQuery>)?;
        self.get(url).await
    }
}
