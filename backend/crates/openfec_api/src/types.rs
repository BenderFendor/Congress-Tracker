use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub pagination: Pagination,
}

// Custom deserialization to handle OpenFEC's "results" field
impl<'de, T: serde::Deserialize<'de>> serde::Deserialize<'de> for PaginatedResponse<T> {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct Helper<T> {
            results: Vec<T>,
            pagination: Pagination,
        }
        let helper = Helper::deserialize(deserializer)?;
        Ok(PaginatedResponse {
            data: helper.results,
            pagination: helper.pagination,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Pagination {
    pub count: u32,
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_pages")]
    pub pages: u32,
    pub per_page: u32,
    #[serde(rename = "is_count_exact")]
    pub is_count_exact: Option<bool>,
}

fn default_page() -> u32 {
    1
}
fn default_pages() -> u32 {
    1
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Candidate {
    pub candidate_id: String,
    pub name: String,
    pub office: Option<String>,
    pub party: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub incumbent_challenge: Option<String>,
    pub candidate_status: Option<String>,
    pub first_file_date: Option<String>,
    pub last_file_date: Option<String>,
    pub url: Option<String>,
    pub active_through: Option<i32>,
    pub election_years: Option<Vec<i32>>,
    pub cycles: Option<Vec<i32>>,
    pub incumbent_challenge_full: Option<String>,
    pub office_full: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Committee {
    pub committee_id: String,
    pub name: String,
    pub committee_type: Option<String>,
    pub party: Option<String>,
    pub state: Option<String>,
    pub treasurer_name: Option<String>,
    pub committee_type_full: Option<String>,
    pub designation: Option<String>,
    pub designation_full: Option<String>,
    pub affiliated_committee_name: Option<String>,
    pub sponsor_candidate_ids: Option<Vec<String>>,
    pub filing_frequency: Option<String>,
    pub first_file_date: Option<String>,
    pub last_file_date: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Receipt {
    #[serde(default)]
    pub committee_id: Option<String>,
    #[serde(default)]
    pub committee_name: Option<String>,
    #[serde(default)]
    pub contributor_name: Option<String>,
    #[serde(default)]
    pub contributor_city: Option<String>,
    #[serde(default)]
    pub contributor_state: Option<String>,
    #[serde(default)]
    pub contribution_date: Option<String>,
    #[serde(default)]
    pub contribution_amount: Option<f64>,
    #[serde(default)]
    pub contribution_type: Option<String>,
    #[serde(default)]
    pub memo_text: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub candidate_id: Option<String>,
    #[serde(default)]
    pub contributor_committee_id: Option<String>,
    #[serde(default)]
    pub contributor_employer: Option<String>,
    #[serde(default)]
    pub contributor_occupation: Option<String>,
    #[serde(default)]
    pub image_number: Option<String>,
    #[serde(default)]
    pub two_year_transaction_period: Option<i32>,
    #[serde(default)]
    pub committee_type_full: Option<String>,
    #[serde(default)]
    pub committee_designation: Option<String>,
    #[serde(default)]
    pub support_oppose_indicator: Option<String>,
    #[serde(default)]
    pub recipient_name: Option<String>,
    #[serde(default)]
    pub recipient_committee_id: Option<String>,
    #[serde(default)]
    pub purpose: Option<String>,
    #[serde(default)]
    pub transaction_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CandidateTotal {
    pub candidate_id: String,
    pub cycle: Option<i32>,
    pub receipts: Option<f64>,
    pub disbursements: Option<f64>,
    pub individual_itemized_contributions: Option<f64>,
    pub individual_unitemized_contributions: Option<f64>,
    pub other_political_committee_contributions: Option<f64>,
    pub candidate_contribution: Option<f64>,
    pub total_contributions: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndependentExpenditure {
    pub committee_id: Option<String>,
    pub committee_name: Option<String>,
    pub candidate_id: Option<String>,
    pub candidate_name: Option<String>,
    pub support_oppose_indicator: Option<String>,
    pub expenditure_amount: Option<f64>,
    pub expenditure_date: Option<String>,
    pub payee_name: Option<String>,
    pub purpose: Option<String>,
    pub cycle: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ElectionSummary {
    pub count: i32,
    pub results: Vec<ElectionResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ElectionResult {
    pub candidate_id: String,
    pub cycle: i32,
    pub state: Option<String>,
    pub district: Option<String>,
    pub office: Option<String>,
    pub incumbent: Option<bool>,
    pub total_receipts: Option<f64>,
    pub total_disbursements: Option<f64>,
    pub cash_on_hand_end_period: Option<f64>,
}
