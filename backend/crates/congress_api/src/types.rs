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

#[derive(Debug, Serialize, Deserialize)]
pub struct BillDetail {
    pub bill: Bill,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillActionsResponse {
    pub actions: Vec<BillAction>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillAction {
    #[serde(rename = "actionDate")]
    pub action_date: Option<String>,
    pub text: String,
    #[serde(rename = "type")]
    pub action_type: Option<String>,
    #[serde(rename = "actionCode")]
    pub action_code: Option<String>,
    #[serde(rename = "sourceSystem")]
    pub source_system: Option<SourceSystem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SourceSystem {
    pub name: Option<String>,
    pub code: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillCosponsorsResponse {
    pub cosponsors: Vec<BillCosponsor>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillCosponsor {
    #[serde(rename = "bioguideId")]
    pub bioguide_id: Option<String>,
    #[serde(rename = "fullName")]
    pub full_name: String,
    #[serde(rename = "firstName")]
    pub first_name: Option<String>,
    #[serde(rename = "lastName")]
    pub last_name: Option<String>,
    pub state: Option<String>,
    pub party: Option<String>,
    #[serde(rename = "sponsorshipDate")]
    pub sponsorship_date: Option<String>,
    #[serde(rename = "isOriginalCosponsor")]
    pub is_original_cosponsor: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillSubjectsResponse {
    pub subjects: BillSubjects,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillSubjects {
    #[serde(rename = "legislativeSubjects")]
    pub legislative_subjects: Option<Vec<BillSubject>>,
    #[serde(rename = "policyArea")]
    pub policy_area: Option<BillPolicyArea>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillSubject {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillPolicyArea {
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillSummariesResponse {
    pub summaries: Vec<BillSummary>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillSummary {
    pub text: Option<String>,
    #[serde(rename = "actionDate")]
    pub action_date: Option<String>,
    #[serde(rename = "actionDesc")]
    pub action_desc: Option<String>,
    #[serde(rename = "versionCode")]
    pub version_code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillTextResponse {
    #[serde(rename = "textVersions")]
    pub text_versions: Vec<BillTextVersion>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillTextVersion {
    pub date: Option<String>,
    pub formats: Vec<BillTextFormat>,
    #[serde(rename = "type")]
    pub version_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillTextFormat {
    pub url: String,
    #[serde(rename = "type")]
    pub format_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillAmendmentsResponse {
    pub amendments: Vec<BillAmendment>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillAmendment {
    pub number: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "amendmentType")]
    pub amendment_type: Option<String>,
    #[serde(rename = "sponsorName")]
    pub sponsor_name: Option<String>,
    #[serde(rename = "sponsorBioguideId")]
    pub sponsor_bioguide_id: Option<String>,
    #[serde(rename = "introducedDate")]
    pub introduced_date: Option<String>,
    #[serde(rename = "latestAction")]
    pub latest_action: Option<AmendmentAction>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AmendmentAction {
    #[serde(rename = "actionDate")]
    pub action_date: Option<String>,
    pub text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemberSponsoredResponse {
    #[serde(rename = "sponsoredLegislation")]
    pub sponsored_legislation: Vec<MemberSponsoredBill>,
    pub pagination: Pagination,
    pub request: Option<Request>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemberCosponsoredResponse {
    #[serde(rename = "cosponsoredLegislation")]
    pub cosponsored_legislation: Vec<MemberSponsoredBill>,
    pub pagination: Pagination,
    pub request: Option<Request>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemberSponsoredBill {
    pub congress: i32,
    pub url: Option<String>,
    #[serde(rename = "type")]
    pub bill_type: Option<String>,
    pub number: Option<String>,
    pub title: Option<String>,
    #[serde(rename = "introducedDate")]
    pub introduced_date: Option<String>,
    #[serde(rename = "latestAction")]
    pub latest_action: Option<BillLatestAction>,
    #[serde(rename = "policyArea")]
    pub policy_area: Option<BillPolicyArea>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillLatestAction {
    #[serde(rename = "actionDate")]
    pub action_date: Option<String>,
    pub text: Option<String>,
}

// Add to existing Vote type:
#[derive(Debug, Serialize, Deserialize)]
pub struct VotePositionsResponse {
    pub positions: Vec<VotePosition>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VotePosition {
    #[serde(rename = "bioguideId")]
    pub bioguide_id: Option<String>,
    pub member_name: Option<String>,
    pub position: String,
    pub state: Option<String>,
    pub party: Option<String>,
}
