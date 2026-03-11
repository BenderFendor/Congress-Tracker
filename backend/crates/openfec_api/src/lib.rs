//! OpenFEC API Client
//!
//! This crate provides a client for accessing the Federal Election Commission's
//! OpenFEC API, which includes campaign finance data such as candidates,
//! committees, donations, and filings.

pub mod client;
pub mod query;
pub mod types;

pub use client::Client;
pub use query::{CandidateQuery, CommitteeQuery, ReceiptQuery};
pub use types::{Candidate, Committee, Receipt, PaginatedResponse};

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
