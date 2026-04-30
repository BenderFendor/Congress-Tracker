use serde::{Deserialize, Serialize};

pub const API_BASE: &str = "https://civdotiq.org/api/v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CiviqResponse<T> {
    pub data: T,
    #[serde(default)]
    pub meta: Option<CiviqMeta>,
    #[serde(default)]
    pub pagination: Option<CiviqPagination>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CiviqMeta {
    #[serde(default, rename = "apiVersion")]
    pub api_version: Option<String>,
    #[serde(default)]
    pub timestamp: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub license: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CiviqPagination {
    #[serde(default)]
    pub total: u64,
    #[serde(default)]
    pub limit: u64,
    #[serde(default)]
    pub offset: u64,
    #[serde(default, rename = "hasMore")]
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Representative {
    #[serde(rename = "bioguideId")]
    pub bioguide_id: String,
    pub name: String,
    pub party: String,
    pub state: String,
    #[serde(default)]
    pub district: Option<String>,
    #[serde(default)]
    pub chamber: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
    #[serde(default, rename = "yearsInOffice")]
    pub years_in_office: Option<u32>,
    #[serde(default, rename = "nextElection")]
    pub next_election: Option<String>,
    #[serde(default)]
    pub bio: Option<CiviqBio>,
    #[serde(default)]
    pub committees: Option<Vec<CiviqCommittee>>,
    #[serde(default, rename = "currentTerm")]
    pub current_term: Option<CiviqTerm>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CiviqBio {
    #[serde(default)]
    pub birthday: Option<String>,
    #[serde(default)]
    pub gender: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CiviqTerm {
    #[serde(default)]
    pub start: Option<String>,
    #[serde(default)]
    pub end: Option<String>,
    #[serde(default)]
    pub office: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CiviqCommittee {
    pub name: String,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub thomas_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteResult {
    #[serde(rename = "voteId")]
    pub vote_id: String,
    pub chamber: String,
    pub congress: u32,
    #[serde(rename = "rollNumber")]
    pub roll_number: u32,
    pub question: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub result: Option<String>,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub time: Option<String>,
    #[serde(default)]
    pub totals: Option<CiviqVoteTotals>,
    #[serde(default)]
    pub positions: Option<Vec<CiviqVotePosition>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CiviqVoteTotals {
    #[serde(default)]
    pub yea: u32,
    #[serde(default)]
    pub nay: u32,
    #[serde(default)]
    pub present: u32,
    #[serde(default, rename = "notVoting")]
    pub not_voting: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CiviqVotePosition {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub party: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub vote: Option<String>,
    #[serde(default, rename = "bioguideId")]
    pub bioguide_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillSummary {
    pub congress: u32,
    pub number: String,
    #[serde(rename = "type")]
    pub bill_type: String,
    pub title: String,
    #[serde(default, rename = "originChamber")]
    pub origin_chamber: Option<String>,
    #[serde(default, rename = "updateDate")]
    pub update_date: Option<String>,
    #[serde(default, rename = "latestAction")]
    pub latest_action: Option<serde_json::Value>,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CiviqCommitteeListing {
    pub name: String,
    pub chamber: String,
    #[serde(default, rename = "systemCode")]
    pub system_code: Option<String>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
}
