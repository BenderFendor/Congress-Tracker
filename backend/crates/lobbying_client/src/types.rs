use serde::{Deserialize, Serialize};

// ── Reference types (nested within Filing) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrantRef {
    #[serde(default)]
    pub id: Option<i64>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub house_registrant_id: Option<i64>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub address_1: Option<String>,
    #[serde(default)]
    pub address_2: Option<String>,
    #[serde(default)]
    pub address_3: Option<String>,
    #[serde(default)]
    pub address_4: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub state_display: Option<String>,
    #[serde(default)]
    pub zip: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub country_display: Option<String>,
    #[serde(default)]
    pub ppb_country: Option<String>,
    #[serde(default)]
    pub ppb_country_display: Option<String>,
    #[serde(default)]
    pub contact_name: Option<String>,
    #[serde(default)]
    pub contact_telephone: Option<String>,
    #[serde(default)]
    pub dt_updated: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientRef {
    #[serde(default)]
    pub id: Option<i64>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub client_id: Option<i64>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub general_description: Option<String>,
    #[serde(default)]
    pub client_government_entity: Option<serde_json::Value>,
    #[serde(default)]
    pub client_self_select: Option<bool>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub state_display: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub country_display: Option<String>,
    #[serde(default)]
    pub ppb_state: Option<String>,
    #[serde(default)]
    pub ppb_state_display: Option<String>,
    #[serde(default)]
    pub ppb_country: Option<String>,
    #[serde(default)]
    pub ppb_country_display: Option<String>,
    #[serde(default)]
    pub effective_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LobbyistRef {
    #[serde(default)]
    pub id: Option<i64>,
    #[serde(default)]
    pub prefix: Option<String>,
    #[serde(default)]
    pub prefix_display: Option<String>,
    #[serde(default)]
    pub first_name: Option<String>,
    #[serde(default)]
    pub nickname: Option<String>,
    #[serde(default)]
    pub middle_name: Option<String>,
    #[serde(default)]
    pub last_name: Option<String>,
    #[serde(default)]
    pub suffix: Option<String>,
    #[serde(default)]
    pub suffix_display: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LobbyingActivity {
    #[serde(default)]
    pub general_issue_code: Option<String>,
    #[serde(default)]
    pub general_issue_code_display: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub foreign_entity_issues: Option<String>,
    #[serde(default)]
    pub lobbyists: Option<Vec<LobbyistActivityEntry>>,
    #[serde(default)]
    pub government_entities: Option<Vec<GovernmentEntity>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LobbyistActivityEntry {
    #[serde(default)]
    pub lobbyist: Option<LobbyistRef>,
    #[serde(default)]
    pub covered_position: Option<String>,
    #[serde(default)]
    pub new: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernmentEntity {
    #[serde(default)]
    pub id: Option<i64>,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ConvictionDisclosure {}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ForeignEntity {}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AffiliatedOrganization {}

// ── Top-level data models ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Filing {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub filing_uuid: Option<String>,
    #[serde(default)]
    pub filing_year: Option<u32>,
    #[serde(default)]
    pub filing_period: Option<String>,
    #[serde(default)]
    pub filing_period_display: Option<String>,
    #[serde(default)]
    pub filing_type: Option<String>,
    #[serde(default)]
    pub filing_type_display: Option<String>,
    #[serde(default)]
    pub income: Option<String>,
    #[serde(default)]
    pub expenses: Option<String>,
    #[serde(default)]
    pub expenses_method: Option<String>,
    #[serde(default)]
    pub expenses_method_display: Option<String>,
    #[serde(default)]
    pub posted_by_name: Option<String>,
    #[serde(default)]
    pub dt_posted: Option<String>,
    #[serde(default)]
    pub termination_date: Option<String>,
    #[serde(default)]
    pub registrant_country: Option<String>,
    #[serde(default)]
    pub registrant_ppb_country: Option<String>,
    #[serde(default)]
    pub registrant_address_1: Option<String>,
    #[serde(default)]
    pub registrant_address_2: Option<String>,
    #[serde(default)]
    pub registrant_different_address: Option<serde_json::Value>,
    #[serde(default)]
    pub registrant_city: Option<String>,
    #[serde(default)]
    pub registrant_state: Option<String>,
    #[serde(default)]
    pub registrant_zip: Option<String>,
    #[serde(default)]
    pub filing_document_url: Option<String>,
    #[serde(default)]
    pub filing_document_content_type: Option<String>,
    #[serde(default)]
    pub registrant: Option<RegistrantRef>,
    #[serde(default)]
    pub client: Option<ClientRef>,
    #[serde(default)]
    pub lobbyists: Option<Vec<LobbyistRef>>,
    #[serde(default)]
    pub lobbying_activities: Option<Vec<LobbyingActivity>>,
    #[serde(default)]
    pub government_entities: Option<Vec<GovernmentEntity>>,
    #[serde(default)]
    pub issues: Option<Vec<String>>,
    #[serde(default)]
    pub conviction_disclosures: Option<Vec<ConvictionDisclosure>>,
    #[serde(default)]
    pub foreign_entities: Option<Vec<ForeignEntity>>,
    #[serde(default)]
    pub affiliated_organizations: Option<Vec<AffiliatedOrganization>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Registrant {
    #[serde(default)]
    pub id: Option<i64>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub house_registrant_id: Option<i64>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub address_1: Option<String>,
    #[serde(default)]
    pub address_2: Option<String>,
    #[serde(default)]
    pub address_3: Option<String>,
    #[serde(default)]
    pub address_4: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub state_display: Option<String>,
    #[serde(default)]
    pub zip: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub country_display: Option<String>,
    #[serde(default)]
    pub ppb_country: Option<String>,
    #[serde(default)]
    pub ppb_country_display: Option<String>,
    #[serde(default)]
    pub contact_name: Option<String>,
    #[serde(default)]
    pub contact_telephone: Option<String>,
    #[serde(default)]
    pub dt_updated: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Client {
    #[serde(default)]
    pub id: Option<i64>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub client_id: Option<i64>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub general_description: Option<String>,
    #[serde(default)]
    pub client_government_entity: Option<serde_json::Value>,
    #[serde(default)]
    pub client_self_select: Option<bool>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub state_display: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub country_display: Option<String>,
    #[serde(default)]
    pub ppb_state: Option<String>,
    #[serde(default)]
    pub ppb_state_display: Option<String>,
    #[serde(default)]
    pub ppb_country: Option<String>,
    #[serde(default)]
    pub ppb_country_display: Option<String>,
    #[serde(default)]
    pub effective_date: Option<String>,
    #[serde(default)]
    pub registrant: Option<RegistrantRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lobbyist {
    #[serde(default)]
    pub id: Option<i64>,
    #[serde(default)]
    pub prefix: Option<String>,
    #[serde(default)]
    pub prefix_display: Option<String>,
    #[serde(default)]
    pub first_name: Option<String>,
    #[serde(default)]
    pub nickname: Option<String>,
    #[serde(default)]
    pub middle_name: Option<String>,
    #[serde(default)]
    pub last_name: Option<String>,
    #[serde(default)]
    pub suffix: Option<String>,
    #[serde(default)]
    pub suffix_display: Option<String>,
    #[serde(default)]
    pub registrant: Option<RegistrantRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contribution {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub filing_uuid: Option<String>,
    #[serde(default)]
    pub filing_type: Option<String>,
    #[serde(default)]
    pub filing_type_display: Option<String>,
    #[serde(default)]
    pub filing_year: Option<u32>,
    #[serde(default)]
    pub filing_period: Option<String>,
    #[serde(default)]
    pub filing_period_display: Option<String>,
    #[serde(default)]
    pub filing_document_url: Option<String>,
    #[serde(default)]
    pub filing_document_content_type: Option<String>,
    #[serde(default)]
    pub filer_type: Option<String>,
    #[serde(default)]
    pub filer_type_display: Option<String>,
    #[serde(default)]
    pub dt_posted: Option<String>,
    #[serde(default)]
    pub contact_name: Option<String>,
    #[serde(default)]
    pub comments: Option<String>,
    #[serde(default)]
    pub address_1: Option<String>,
    #[serde(default)]
    pub address_2: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub state_display: Option<String>,
    #[serde(default)]
    pub zip: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub country_display: Option<String>,
    #[serde(default)]
    pub registrant: Option<RegistrantRef>,
    #[serde(default)]
    pub lobbyist: Option<LobbyistRef>,
    #[serde(default)]
    pub no_contributions: Option<bool>,
    #[serde(default)]
    pub pacs: Option<Vec<String>>,
    #[serde(default)]
    pub contribution_items: Option<Vec<ContributionItem>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ContributionItem {}

// ── Paginated response wrapper ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub count: u64,
    #[serde(default)]
    pub next: Option<String>,
    #[serde(default)]
    pub previous: Option<String>,
    pub results: Vec<T>,
}

// ── Issue joiner enum ──

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum IssueJoiner {
    And,
    #[default]
    Or,
}

impl std::fmt::Display for IssueJoiner {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IssueJoiner::And => write!(f, "and"),
            IssueJoiner::Or => write!(f, "or"),
        }
    }
}

// ── Query types ──

#[derive(Debug, Clone, Default, Serialize)]
pub struct FilingQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filing_specific_lobbying_issues: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filing_year: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filing_period: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registrant_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filing_dt_posted_before: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filing_dt_posted_after: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filing_amount_reported_min: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filing_amount_reported_max: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filing_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_size: Option<u32>,
}

impl FilingQuery {
    pub fn format_issues(&self) -> Option<String> {
        self.filing_specific_lobbying_issues.clone()
    }

    pub fn with_issues(mut self, issues: &[String]) -> Self {
        let formatted = FilingQuery::format_issue_list(issues, IssueJoiner::Or);
        self.filing_specific_lobbying_issues = Some(formatted);
        self
    }

    pub fn with_issues_and_joiner(mut self, issues: &[String], joiner: IssueJoiner) -> Self {
        let formatted = FilingQuery::format_issue_list(issues, joiner);
        self.filing_specific_lobbying_issues = Some(formatted);
        self
    }

    pub fn with_issue_joiner(self, _joiner: IssueJoiner) -> Self {
        self
    }

    fn format_issue_list(issues: &[String], joiner: IssueJoiner) -> String {
        let sep = match joiner {
            IssueJoiner::Or => " OR ",
            IssueJoiner::And => " +AND+ ",
        };
        issues
            .iter()
            .map(|s| format!("\"{}\"", s))
            .collect::<Vec<_>>()
            .join(sep)
    }

    pub fn with_year(mut self, year: u32) -> Self {
        self.filing_year = Some(year);
        self
    }

    pub fn with_period(mut self, period: impl Into<String>) -> Self {
        self.filing_period = Some(period.into());
        self
    }

    pub fn with_client(mut self, client: impl Into<String>) -> Self {
        self.client_name = Some(client.into());
        self
    }

    pub fn with_registrant(mut self, registrant: impl Into<String>) -> Self {
        self.registrant_name = Some(registrant.into());
        self
    }

    pub fn with_posted_before(mut self, date: impl Into<String>) -> Self {
        self.filing_dt_posted_before = Some(date.into());
        self
    }

    pub fn with_posted_after(mut self, date: impl Into<String>) -> Self {
        self.filing_dt_posted_after = Some(date.into());
        self
    }

    pub fn with_amount_min(mut self, amount: impl Into<String>) -> Self {
        self.filing_amount_reported_min = Some(amount.into());
        self
    }

    pub fn with_amount_max(mut self, amount: impl Into<String>) -> Self {
        self.filing_amount_reported_max = Some(amount.into());
        self
    }

    pub fn with_page(mut self, page: u32) -> Self {
        self.page = Some(page);
        self
    }

    pub fn with_page_size(mut self, page_size: u32) -> Self {
        self.page_size = Some(page_size);
        self
    }
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct RegistrantQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registrant_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_size: Option<u32>,
}

impl RegistrantQuery {
    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.registrant_name = Some(name.into());
        self
    }

    pub fn with_state(mut self, state: impl Into<String>) -> Self {
        self.state = Some(state.into());
        self
    }

    pub fn with_country(mut self, country: impl Into<String>) -> Self {
        self.country = Some(country.into());
        self
    }

    pub fn with_page(mut self, page: u32) -> Self {
        self.page = Some(page);
        self
    }

    pub fn with_page_size(mut self, page_size: u32) -> Self {
        self.page_size = Some(page_size);
        self
    }
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ClientQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_size: Option<u32>,
}

impl ClientQuery {
    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.client_name = Some(name.into());
        self
    }

    pub fn with_state(mut self, state: impl Into<String>) -> Self {
        self.state = Some(state.into());
        self
    }

    pub fn with_country(mut self, country: impl Into<String>) -> Self {
        self.country = Some(country.into());
        self
    }

    pub fn with_page(mut self, page: u32) -> Self {
        self.page = Some(page);
        self
    }

    pub fn with_page_size(mut self, page_size: u32) -> Self {
        self.page_size = Some(page_size);
        self
    }
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct LobbyistQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lobbyist_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_size: Option<u32>,
}

impl LobbyistQuery {
    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.lobbyist_name = Some(name.into());
        self
    }

    pub fn with_state(mut self, state: impl Into<String>) -> Self {
        self.state = Some(state.into());
        self
    }

    pub fn with_country(mut self, country: impl Into<String>) -> Self {
        self.country = Some(country.into());
        self
    }

    pub fn with_page(mut self, page: u32) -> Self {
        self.page = Some(page);
        self
    }

    pub fn with_page_size(mut self, page_size: u32) -> Self {
        self.page_size = Some(page_size);
        self
    }
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ContributionQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filing_year: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filer_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registrant_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lobbyist_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_size: Option<u32>,
}

impl ContributionQuery {
    pub fn with_year(mut self, year: u32) -> Self {
        self.filing_year = Some(year);
        self
    }

    pub fn with_filer_type(mut self, filer_type: impl Into<String>) -> Self {
        self.filer_type = Some(filer_type.into());
        self
    }

    pub fn with_registrant(mut self, registrant: impl Into<String>) -> Self {
        self.registrant_name = Some(registrant.into());
        self
    }

    pub fn with_lobbyist(mut self, lobbyist: impl Into<String>) -> Self {
        self.lobbyist_name = Some(lobbyist.into());
        self
    }

    pub fn with_page(mut self, page: u32) -> Self {
        self.page = Some(page);
        self
    }

    pub fn with_page_size(mut self, page_size: u32) -> Self {
        self.page_size = Some(page_size);
        self
    }
}
