//! Congress.gov API Client
//!
//! This crate provides a client for accessing the Congress.gov API,
//! which includes legislative data such as bills, amendments, votes,
//! and member information.

pub mod client;
pub mod pagination;
pub mod query;
pub mod types;

pub use client::Client;
pub use pagination::{
    canonical_member_legislation_source_url, MemberLegislationIdentity,
    MemberLegislationPagination, PageProgress, PaginationError, MEMBER_LEGISLATION_MAX_ROWS,
    MEMBER_LEGISLATION_MIN_PAGE_LIMIT, MEMBER_LEGISLATION_PAGE_LIMIT,
};
pub use query::{BillQuery, MemberQuery, VoteQuery};
pub use types::{
    AmendmentAction, Bill, BillAction, BillActionsResponse, BillAmendment, BillAmendmentsResponse,
    BillCosponsor, BillCosponsorsResponse, BillDetail, BillLatestAction, BillPolicyArea,
    BillSubject, BillSubjects, BillSubjectsResponse, BillSummariesResponse, BillSummary,
    BillTextFormat, BillTextResponse, BillTextVersion, Member, MemberCosponsoredResponse,
    MemberSponsoredBill, MemberSponsoredResponse, PaginatedResponse, SourceSystem, Vote,
    VotePosition, VotePositionsResponse,
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("JSON serialization failed: {0}")]
    Json(#[from] serde_json::Error),
    #[error("URL parsing failed: {0}")]
    Url(#[from] url::ParseError),
    #[error("API error: {0}")]
    Api(String),
    #[error("Congress.gov API key is invalid or expired: {0}")]
    InvalidApiKey(String),
}

impl Error {
    pub fn allows_member_legislation_page_reduction(&self) -> bool {
        matches!(
            self,
            Self::Http(error) if error.is_timeout() || error.is_body() || error.is_decode()
        )
    }

    pub fn is_invalid_api_key(&self) -> bool {
        matches!(self, Self::InvalidApiKey(_))
    }
}
