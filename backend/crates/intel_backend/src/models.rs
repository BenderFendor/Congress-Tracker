/// Shared serializable API response models used across routes.
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Source provenance models ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceSource {
    pub source: String,
    pub status: String,
    pub fetched_at: Option<String>,
    pub confidence: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceSummary {
    pub sources: Vec<ProvenanceSource>,
    pub warnings: Vec<String>,
}

// ── Member profile ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberProfile {
    pub bioguide_id: String,
    pub first_name: String,
    pub middle_name: String,
    pub last_name: String,
    pub suffix: String,
    pub official_full_name: String,
    pub birthday: Option<NaiveDate>,
    pub age: Option<i32>,
    pub gender: Option<String>,
    pub current_party: String,
    pub current_state: String,
    pub current_district: String,
    pub current_chamber: String,
    pub in_office: bool,
    pub depiction_url: Option<String>,
    pub website_url: Option<String>,
    pub contact_form: Option<String>,
    pub office_address: Option<String>,
    pub phone: Option<String>,
    pub years_in_office: Option<f64>,
    pub service_start: Option<NaiveDate>,
    pub current_term_end: Option<NaiveDate>,
    pub next_election: Option<NaiveDate>,
    pub party_history: Vec<PartyHistory>,
    pub terms: Vec<MemberTerm>,
    pub identifiers: HashMap<String, Vec<String>>,
    pub education: serde_json::Value,
    pub prior_employment: serde_json::Value,
    pub hometown: Option<String>,
    pub birthplace: Option<String>,
    pub nominate_dim1: Option<f64>,
    pub nominate_dim2: Option<f64>,
    pub biography_summary: Option<String>,
    pub biography_full: Option<String>,
    pub committees: Vec<CommitteeAssignment>,
    pub social_accounts: Vec<SocialAccount>,
    pub provenance: ProvenanceSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartyHistory {
    pub party: String,
    pub start: Option<NaiveDate>,
    pub end: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberTerm {
    pub chamber: String,
    pub state: String,
    pub district: Option<String>,
    pub party: String,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub senate_class: Option<i32>,
    pub how: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitteeAssignment {
    /// Member info (populated for committee rosters)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bioguide_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub party: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub district: Option<String>,
    /// Committee info (populated for member profiles)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub committee_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chamber: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub congress: Option<i32>,
    /// Shared fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rank: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocialAccount {
    pub platform: String,
    pub handle: String,
    pub official: bool,
}

// ── Bill intel ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillIntel {
    pub bill: BillInfo,
    pub actions: Vec<BillAction>,
    pub sponsors: Vec<BillSponsorInfo>,
    pub cosponsors: Vec<BillSponsorInfo>,
    pub subjects: Vec<String>,
    pub text_versions: Vec<BillTextVersion>,
    pub related_votes: Vec<VoteInfo>,
    pub amendments: Vec<BillAmendment>,
    pub funding_overlay: Vec<SponsorFundingOverlay>,
    pub lobbying_overlay: Vec<LobbyingMatch>,
    pub lobbying_bill_links: Vec<LobbyingBillLink>,
    pub provenance: ProvenanceSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BillAmendment {
    pub bill_id: String,
    pub congress: i32,
    pub bill_type: String,
    pub bill_number: i32,
    pub amendment_number: Option<String>,
    pub description: Option<String>,
    pub amendment_type: Option<String>,
    pub sponsor_name: Option<String>,
    pub sponsor_bioguide_id: Option<String>,
    pub introduced_date: Option<NaiveDate>,
    pub latest_action_date: Option<NaiveDate>,
    pub latest_action_text: Option<String>,
    pub chamber: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillInfo {
    pub congress: i32,
    pub bill_type: String,
    pub bill_number: i32,
    pub bill_id: String,
    pub title: String,
    pub introduced_date: Option<NaiveDate>,
    pub origin_chamber: Option<String>,
    pub policy_area: Option<String>,
    pub latest_action_date: Option<NaiveDate>,
    pub latest_action_text: Option<String>,
    pub status: String,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillAction {
    pub action_date: Option<NaiveDate>,
    pub action_text: String,
    pub action_type: Option<String>,
    pub chamber: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillSponsorInfo {
    pub bioguide_id: Option<String>,
    pub name: String,
    pub sponsor_type: String,
    pub is_original_cosponsor: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillTextVersion {
    pub version_code: Option<String>,
    pub version_name: Option<String>,
    pub format: Option<String>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteInfo {
    pub vote_id: String,
    pub congress: i32,
    pub chamber: String,
    pub roll_number: i32,
    pub vote_date: Option<NaiveDate>,
    pub question: String,
    pub result: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SponsorFundingOverlay {
    pub bioguide_id: String,
    pub name: String,
    pub total_receipts: f64,
    pub top_networks: Vec<NetworkAmount>,
    pub nominate_dim1: Option<f64>,
    pub data_quality: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkAmount {
    pub network_slug: String,
    pub amount: f64,
    pub confidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LobbyingMatch {
    pub filing_uuid: String,
    pub registrant_name: String,
    pub client_name: String,
    pub issue_code: Option<String>,
    pub issue_display: Option<String>,
    pub matched_keyword: String,
    pub confidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LobbyingBillLink {
    pub filing_uuid: String,
    pub registrant_name: String,
    pub client_name: String,
    pub matched_bill_text: Option<String>,
    pub confidence: String,
}

// ── Funding ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberFunding {
    pub bioguide_id: String,
    pub cycle: i32,
    pub direct_receipts: f64,
    pub pac_receipts: f64,
    pub individual_receipts: f64,
    pub independent_expenditures_supporting: f64,
    pub independent_expenditures_opposing: f64,
    pub top_donors: Vec<DonorSummary>,
    pub top_committees: Vec<CommitteeFunding>,
    #[serde(default)]
    pub committee_relationships: Vec<CommitteeFunding>,
    #[serde(default)]
    pub leadership_pacs: Vec<LeadershipPacFunding>,
    pub influence_networks: Vec<InfluenceNetworkFunding>,
    pub has_successful_fec_run: bool,
    pub provenance: ProvenanceSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DonorSummary {
    pub contributor_name: String,
    pub amount: f64,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitteeFunding {
    pub committee_id: String,
    pub committee_name: String,
    pub amount: f64,
    pub relationship_type: Option<String>,
    pub resolution_status: Option<String>,
    pub transaction_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LeadershipPacFunding {
    pub committee_id: String,
    pub committee_name: String,
    pub sponsor_name: Option<String>,
    pub cash_on_hand: Option<f64>,
    pub total_disbursements: Option<f64>,
    pub total_receipts: Option<f64>,
    pub coverage_end_date: Option<NaiveDate>,
    pub source_url: Option<String>,
    pub resolution_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfluenceNetworkFunding {
    pub network_slug: String,
    pub display_name: String,
    pub direct_pac: f64,
    pub independent_supporting: f64,
    pub independent_opposing: f64,
    pub confidence: String,
}

// ── Influence network ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfluenceNetwork {
    pub network_slug: String,
    pub display_name: String,
    /// Search-only labels. Canonical names and FEC identities remain separate fields.
    pub aliases: Vec<String>,
    pub description: String,
    pub category: String,
    pub confidence: String,
    pub source_citation: String,
    pub committees: Vec<InfluenceNetworkCommittee>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfluenceNetworkCommittee {
    pub committee_id: String,
    pub committee_name: String,
    pub role: String,
    pub confidence: String,
    pub source_citation: String,
}

/// Financial summary for a single committee within an influence network.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitteeFinancial {
    pub committee_id: String,
    pub committee_name: String,
    pub role: String,
    pub direct_contributions: f64,
    pub independent_supporting: f64,
    pub independent_opposing: f64,
    /// Total reported activity across the three separate channels. This is not
    /// an amount received by a campaign.
    pub total: f64,
}

/// Financial summary for a recipient member.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipientMember {
    pub bioguide_id: String,
    pub first_name: String,
    pub last_name: String,
    pub party: String,
    pub chamber: String,
    pub state: String,
    /// Money transferred directly to the member's campaign committees.
    pub total_received: f64,
    pub direct_contributions: f64,
    pub independent_supporting: f64,
    pub independent_opposing: f64,
    /// Total reported activity across direct, support, and opposition channels.
    pub total_activity: f64,
}

/// Full financial breakdown for an influence network in a given cycle.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfluenceNetworkFinancials {
    pub network_slug: String,
    pub cycle: i32,
    pub total_direct_contributions: f64,
    pub total_independent_supporting: f64,
    pub total_independent_opposing: f64,
    /// Total reported activity across separate channels, not money received.
    pub total_all: f64,
    pub committees: Vec<CommitteeFinancial>,
    pub top_recipients: Vec<RecipientMember>,
}

// ── Voting ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberVoteSummary {
    pub bioguide_id: String,
    pub congress: i32,
    pub total_votes: i64,
    pub missed_votes: i64,
    pub missed_vote_pct: Option<f64>,
    pub party_line_votes: i64,
    pub party_line_eligible_votes: i64,
    pub party_line_pct: Option<f64>,
    pub first_vote_date: Option<NaiveDate>,
    pub last_vote_date: Option<NaiveDate>,
    pub recent_votes: Vec<VotePosition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VotePosition {
    pub vote_id: String,
    pub congress: i32,
    pub chamber: String,
    pub roll_number: i32,
    pub vote_date: Option<NaiveDate>,
    pub question: String,
    pub position: String,
}

// ── Search ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResults {
    pub query: String,
    pub members: Vec<MemberProfile>,
    pub bills: Vec<BillInfo>,
    pub committees: Vec<CommitteeInfo>,
    pub pacs: Vec<PacInfo>,
    pub lobbying_clients: Vec<LobbyingEntityInfo>,
    pub lobbying_registrants: Vec<LobbyingEntityInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultItem {
    pub r#type: String,
    pub id: String,
    pub label: String,
    pub subtitle: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub query: String,
    pub total: usize,
    pub results: Vec<SearchResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitteeInfo {
    pub committee_id: String,
    pub chamber: String,
    pub name: String,
    pub jurisdiction: Option<String>,
    pub committee_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PacInfo {
    pub committee_id: String,
    pub name: String,
    pub committee_type: Option<String>,
    pub party: Option<String>,
    pub state: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LobbyingEntityInfo {
    pub id: i64,
    pub name: String,
    pub state: Option<String>,
    pub country: Option<String>,
}

// ── Chamber dashboard ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChamberDashboard {
    pub chamber: String,
    pub congress: i32,
    pub member_count: i64,
    pub party_breakdown: HashMap<String, i64>,
    pub avg_nominate_dim1: Option<f64>,
    pub total_direct_receipts: f64,
}

// ── Admin / entity resolution ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityResolutionEntry {
    pub id: i64,
    pub entity_type: String,
    pub source_scheme: String,
    pub source_value: String,
    pub candidate_bioguide_id: Option<String>,
    pub confidence_score: f64,
    pub reason: String,
    pub status: String,
}

// ── Health ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub db: bool,
    pub cache_size: u64,
}

// ── Error types ───────────────────────────────────────────────────────────

/// Application-level error that maps directly to HTTP response status codes.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    /// 400 Bad Request
    #[error("Bad request: {0}")]
    BadRequest(String),

    /// 404 Not Found
    #[error("Not found: {0}")]
    NotFound(String),

    /// 500 Internal Server Error
    #[error("Internal error: {0}")]
    Internal(String),
}

impl axum::response::IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match &self {
            AppError::BadRequest(msg) => (axum::http::StatusCode::BAD_REQUEST, msg.clone()),
            AppError::NotFound(msg) => (axum::http::StatusCode::NOT_FOUND, msg.clone()),
            AppError::Internal(msg) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
        };

        let body = axum::Json(serde_json::json!({
            "error": self.to_string(),
            "message": message,
        }));

        (status, body).into_response()
    }
}
