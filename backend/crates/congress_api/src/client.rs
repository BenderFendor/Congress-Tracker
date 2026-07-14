use serde::de::DeserializeOwned;
use url::Url;

use crate::{
    pagination::{MEMBER_LEGISLATION_MAX_ROWS, MEMBER_LEGISLATION_PAGE_LIMIT},
    query::{BillQuery, MemberQuery, Query, VoteQuery},
    types::{
        Bill, BillActionsResponse, BillAmendmentsResponse, BillCosponsorsResponse, BillDetail,
        BillSubjectsResponse, BillSummariesResponse, BillTextResponse, BillsResponse, Member,
        MemberCosponsoredResponse, MemberSponsoredResponse, MembersResponse, Meta,
        PaginatedResponse, Vote, VotePositionsResponse, VotesResponse,
    },
    Error,
};

#[derive(Clone)]
pub struct Client {
    base_url: String,
    api_key: String,
    http: reqwest::Client,
}

impl Client {
    pub fn new(api_key: String) -> Self {
        let base_url = std::env::var("CONGRESS_GOV_API_BASE_URL")
            .unwrap_or_else(|_| "https://api.congress.gov".to_string());
        let http = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(10))
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Congress.gov HTTP client configuration is valid");
        Self {
            base_url,
            api_key,
            http,
        }
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
        const MAX_ATTEMPTS: u32 = 3;
        for attempt in 1..=MAX_ATTEMPTS {
            let response = match self.http.get(url.clone()).send().await {
                Ok(response)
                    if attempt < MAX_ATTEMPTS
                        && (response.status().as_u16() == 429
                            || response.status().is_server_error()) =>
                {
                    let retry_after = response
                        .headers()
                        .get(reqwest::header::RETRY_AFTER)
                        .and_then(|value| value.to_str().ok())
                        .and_then(|value| value.parse::<u64>().ok())
                        .unwrap_or(u64::from(attempt));
                    tokio::time::sleep(std::time::Duration::from_secs(retry_after.clamp(1, 10)))
                        .await;
                    continue;
                }
                Ok(response) => response,
                Err(error) if attempt < MAX_ATTEMPTS => {
                    let error = error.without_url();
                    tracing::warn!(attempt, error = %error, "Congress.gov request failed; retrying");
                    tokio::time::sleep(std::time::Duration::from_millis(250 * u64::from(attempt)))
                        .await;
                    continue;
                }
                Err(error) => return Err(error.without_url().into()),
            };

            if !response.status().is_success() {
                let status = response.status();
                let text = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown error".to_string());
                if text.contains("API_KEY_INVALID") || status.as_u16() == 403 {
                    return Err(Error::InvalidApiKey(format!(
                        "Get a free key at https://api.congress.gov/sign-up and set CONGRESS_GOV_API_KEY in .env. \
                         (HTTP {}: {})",
                        status, text
                    )));
                }
                return Err(Error::Api(format!("HTTP {}: {}", status, text)));
            }

            match response.json::<T>().await {
                Ok(data) => return Ok(data),
                Err(error) if attempt < MAX_ATTEMPTS => {
                    let error = error.without_url();
                    tracing::warn!(attempt, error = %error, "Congress.gov response body failed; retrying");
                    tokio::time::sleep(std::time::Duration::from_millis(250 * u64::from(attempt)))
                        .await;
                }
                Err(error) => return Err(Error::Http(error.without_url())),
            }
        }
        unreachable!("Congress.gov request loop always returns on its final attempt")
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
        self.get_member_sponsored_legislation_page(bioguide_id, MEMBER_LEGISLATION_PAGE_LIMIT, 0)
            .await
    }

    pub async fn get_member_sponsored_legislation_page(
        &self,
        bioguide_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<MemberSponsoredResponse, Error> {
        self.validate_member_legislation_page(limit, offset)?;
        let path = format!("/v3/member/{}/sponsored-legislation", bioguide_id);
        let query = BillQuery {
            limit: Some(limit),
            offset: Some(offset),
            ..BillQuery::default()
        };
        let url = self.get_url(&path, Some(&query))?;
        self.get(url).await
    }

    /// Get member's cosponsored legislation
    pub async fn get_member_cosponsored_legislation(
        &self,
        bioguide_id: &str,
    ) -> Result<MemberCosponsoredResponse, Error> {
        self.get_member_cosponsored_legislation_page(bioguide_id, MEMBER_LEGISLATION_PAGE_LIMIT, 0)
            .await
    }

    pub async fn get_member_cosponsored_legislation_page(
        &self,
        bioguide_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<MemberCosponsoredResponse, Error> {
        self.validate_member_legislation_page(limit, offset)?;
        let path = format!("/v3/member/{}/cosponsored-legislation", bioguide_id);
        let query = BillQuery {
            limit: Some(limit),
            offset: Some(offset),
            ..BillQuery::default()
        };
        let url = self.get_url(&path, Some(&query))?;
        self.get(url).await
    }

    fn validate_member_legislation_page(&self, limit: u32, offset: u32) -> Result<(), Error> {
        if limit == 0 || limit > MEMBER_LEGISLATION_PAGE_LIMIT {
            return Err(Error::Api(format!(
                "member legislation page limit must be between 1 and {MEMBER_LEGISLATION_PAGE_LIMIT}"
            )));
        }
        if offset >= MEMBER_LEGISLATION_MAX_ROWS {
            return Err(Error::Api(format!(
                "member legislation offset must be below {MEMBER_LEGISLATION_MAX_ROWS}"
            )));
        }
        Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn member_legislation_page_bounds_are_enforced_before_http() {
        let client = Client::new("test-key".to_string());

        assert!(client.validate_member_legislation_page(1, 0).is_ok());
        assert!(client
            .validate_member_legislation_page(
                MEMBER_LEGISLATION_PAGE_LIMIT,
                MEMBER_LEGISLATION_MAX_ROWS - 1,
            )
            .is_ok());
        assert!(client.validate_member_legislation_page(0, 0).is_err());
        assert!(client
            .validate_member_legislation_page(MEMBER_LEGISLATION_PAGE_LIMIT + 1, 0)
            .is_err());
        assert!(client
            .validate_member_legislation_page(1, MEMBER_LEGISLATION_MAX_ROWS)
            .is_err());
    }

    #[test]
    fn member_legislation_page_url_contains_bounded_offset_and_limit() {
        let client = Client {
            base_url: "https://example.test".to_string(),
            api_key: "secret".to_string(),
            http: reqwest::Client::new(),
        };
        let query = BillQuery {
            limit: Some(250),
            offset: Some(500),
            ..BillQuery::default()
        };
        let url = client
            .get_url("/v3/member/A000001/sponsored-legislation", Some(&query))
            .expect("valid test URL");
        let pairs: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();

        assert_eq!(url.path(), "/v3/member/A000001/sponsored-legislation");
        assert_eq!(pairs.get("limit").map(String::as_str), Some("250"));
        assert_eq!(pairs.get("offset").map(String::as_str), Some("500"));
        assert_eq!(pairs.get("api_key").map(String::as_str), Some("secret"));
    }

    #[tokio::test]
    async fn transport_errors_never_expose_the_api_key() {
        let client = Client {
            base_url: "http://127.0.0.1:9".to_string(),
            api_key: "never-log-this-secret".to_string(),
            http: reqwest::Client::builder()
                .connect_timeout(std::time::Duration::from_millis(100))
                .timeout(std::time::Duration::from_millis(100))
                .build()
                .expect("test HTTP client should build"),
        };
        let error = client
            .get_member_sponsored_legislation_page("A000001", 1, 0)
            .await
            .expect_err("closed local port should fail");

        assert!(!error.to_string().contains("never-log-this-secret"));
    }

    #[tokio::test]
    async fn truncated_response_bodies_are_retried() {
        use std::sync::{
            atomic::{AtomicUsize, Ordering},
            Arc,
        };
        use tokio::io::AsyncWriteExt;

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test listener should bind");
        let address = listener.local_addr().expect("test address should resolve");
        let accepted = Arc::new(AtomicUsize::new(0));
        let server_accepted = Arc::clone(&accepted);
        let server = tokio::spawn(async move {
            for _ in 0..3 {
                let (mut stream, _) = listener.accept().await.expect("request should connect");
                server_accepted.fetch_add(1, Ordering::SeqCst);
                stream
                    .write_all(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 100\r\nConnection: close\r\n\r\n{\"partial\":")
                    .await
                    .expect("partial response should write");
            }
        });
        let client = Client {
            base_url: format!("http://{address}"),
            api_key: "never-log-this-secret".to_string(),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(2))
                .build()
                .expect("test HTTP client should build"),
        };
        let url = client
            .get_url("/v3/test", None::<&BillQuery>)
            .expect("test URL should build");
        let error = client
            .get::<serde_json::Value>(url)
            .await
            .expect_err("every response body is truncated");
        server.await.expect("test server should finish");

        assert_eq!(accepted.load(Ordering::SeqCst), 3);
        assert!(error.allows_member_legislation_page_reduction());
        assert!(!error.to_string().contains("never-log-this-secret"));
    }

    #[test]
    fn permanent_api_failures_do_not_trigger_smaller_pages() {
        let invalid_key = Error::InvalidApiKey("test failure".to_string());
        let not_found = Error::Api("HTTP 404: missing".to_string());

        assert!(invalid_key.is_invalid_api_key());
        assert!(!invalid_key.allows_member_legislation_page_reduction());
        assert!(!not_found.is_invalid_api_key());
        assert!(!not_found.allows_member_legislation_page_reduction());
    }

    #[tokio::test]
    async fn forbidden_response_has_a_typed_invalid_key_outcome() {
        use tokio::io::AsyncWriteExt;

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test listener should bind");
        let address = listener.local_addr().expect("test address should resolve");
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.expect("request should connect");
            stream
                .write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: 27\r\nConnection: close\r\n\r\n{\"error\":\"API_KEY_INVALID\"}")
                .await
                .expect("forbidden response should write");
        });
        let client = Client {
            base_url: format!("http://{address}"),
            api_key: "rejected-secret".to_string(),
            http: reqwest::Client::new(),
        };
        let error = client
            .get_member_sponsored_legislation_page("A000001", 1, 0)
            .await
            .expect_err("forbidden response should reject the API key");
        server.await.expect("test server should finish");

        assert!(error.is_invalid_api_key());
        assert!(!error.allows_member_legislation_page_reduction());
        assert!(!error.to_string().contains("rejected-secret"));
    }
}
