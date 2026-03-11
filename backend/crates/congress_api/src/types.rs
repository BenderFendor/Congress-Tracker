use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub meta: Meta,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Meta {
    pub pagination: Pagination,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Pagination {
    pub count: u32,
    #[serde(rename = "next")]
    pub next_url: Option<String>,
    #[serde(rename = "previous")]
    pub previous_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Bill {
    pub congress: u32,
    pub number: String,
    pub title: String,
    #[serde(rename = "type")]
    pub bill_type: String,
    #[serde(rename = "originChamber")]
    pub chamber: String,
    pub introduced_date: Option<String>,
    pub sponsor: Option<BillSponsor>,
    pub cosponsors: Option<Vec<BillSponsor>>,
    pub committees: Option<Vec<Committee>>,
    pub summary: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillSponsor {
    pub bioguide_id: String,
    pub name: String,
    pub party: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Member {
    #[serde(rename = "bioguideId")]
    pub bioguide_id: String,
    pub name: String,
    #[serde(rename = "partyName")]
    pub party: String,
    pub state: String,
    pub district: Option<u32>,
    #[serde(rename = "terms")]
    pub terms: Option<Terms>,
    pub url: Option<String>,
    pub update_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Terms {
    pub item: Vec<Term>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Term {
    pub chamber: String,
    pub end_year: Option<u32>,
    pub start_year: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Vote {
    pub roll_call: u32,
    pub chamber: String,
    pub congress: u32,
    pub session: String,
    pub bill: Option<String>,
    pub question: String,
    pub result: String,
    pub date: String,
    pub votes: Vec<VoteDetail>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VoteDetail {
    pub member_bioguide_id: String,
    pub member_name: String,
    pub vote: String,
    pub party: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Committee {
    pub name: String,
    pub chamber: Option<String>,
    pub url: Option<String>,
}

// Congress.gov specific response types
#[derive(Debug, Serialize, Deserialize)]
pub struct BillsResponse {
    pub bills: Vec<Bill>,
    pub pagination: Pagination,
    pub request: Option<Request>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MembersResponse {
    pub members: Vec<Member>,
    pub pagination: Pagination,
    pub request: Option<Request>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VotesResponse {
    pub votes: Vec<Vote>,
    pub pagination: Pagination,
    pub request: Option<Request>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Request {
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
    pub format: Option<String>,
}
