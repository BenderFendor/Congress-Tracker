//! Congress.gov API Client
//!
//! This crate provides a client for accessing the Congress.gov API,
//! which includes legislative data such as bills, amendments, votes,
//! and member information.

pub mod client;
pub mod query;
pub mod types;

pub use client::Client;
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
}
