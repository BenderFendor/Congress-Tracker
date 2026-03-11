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
    pub page: u32,
    pub pages: u32,
    pub per_page: u32,
    #[serde(rename = "is_count_exact")]
    pub is_count_exact: Option<bool>,
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
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Committee {
    pub committee_id: String,
    pub name: String,
    pub committee_type: Option<String>,
    pub party: Option<String>,
    pub state: Option<String>,
    pub treasurer_name: Option<String>,
    pub filing_frequency: Option<String>,
    pub first_file_date: Option<String>,
    pub last_file_date: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Receipt {
    pub committee_id: String,
    pub committee_name: String,
    pub contributor_name: Option<String>,
    pub contributor_city: Option<String>,
    pub contributor_state: Option<String>,
    pub contribution_date: Option<String>,
    pub contribution_amount: Option<f64>,
    pub contribution_type: Option<String>,
    pub memo_text: Option<String>,
    pub url: Option<String>,
}
