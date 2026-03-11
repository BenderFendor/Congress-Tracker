use url::Url;

pub trait Query {
    fn add_to_url(&self, url: &mut Url);
}

#[derive(Default)]
pub struct CandidateQuery {
    pub name: Option<String>,
    pub state: Option<String>,
    pub party: Option<String>,
    pub office: Option<String>,
    pub limit: Option<u32>,
    pub page: Option<u32>,
}

impl Query for CandidateQuery {
    fn add_to_url(&self, url: &mut Url) {
        if let Some(name) = &self.name {
            url.query_pairs_mut().append_pair("name", name);
        }
        if let Some(state) = &self.state {
            url.query_pairs_mut().append_pair("state", state);
        }
        if let Some(party) = &self.party {
            url.query_pairs_mut().append_pair("party", party);
        }
        if let Some(office) = &self.office {
            url.query_pairs_mut().append_pair("office", office);
        }
        if let Some(limit) = self.limit {
            url.query_pairs_mut()
                .append_pair("per_page", &limit.to_string());
        }
        if let Some(page) = self.page {
            url.query_pairs_mut().append_pair("page", &page.to_string());
        }
    }
}

impl CandidateQuery {
    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }

    pub fn with_state(mut self, state: String) -> Self {
        self.state = Some(state);
        self
    }

    pub fn with_limit(mut self, limit: u32) -> Self {
        self.limit = Some(limit);
        self
    }
}

#[derive(Default)]
pub struct CommitteeQuery {
    pub name: Option<String>,
    pub state: Option<String>,
    pub committee_type: Option<String>,
    pub limit: Option<u32>,
    pub page: Option<u32>,
}

impl Query for CommitteeQuery {
    fn add_to_url(&self, url: &mut Url) {
        if let Some(name) = &self.name {
            url.query_pairs_mut().append_pair("name", name);
        }
        if let Some(state) = &self.state {
            url.query_pairs_mut().append_pair("state", state);
        }
        if let Some(committee_type) = &self.committee_type {
            url.query_pairs_mut()
                .append_pair("committee_type", committee_type);
        }
        if let Some(limit) = self.limit {
            url.query_pairs_mut()
                .append_pair("per_page", &limit.to_string());
        }
        if let Some(page) = self.page {
            url.query_pairs_mut().append_pair("page", &page.to_string());
        }
    }
}

impl CommitteeQuery {
    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }

    pub fn with_state(mut self, state: String) -> Self {
        self.state = Some(state);
        self
    }

    pub fn with_limit(mut self, limit: u32) -> Self {
        self.limit = Some(limit);
        self
    }
}

#[derive(Default)]
pub struct ReceiptQuery {
    pub committee_id: Option<String>,
    pub contributor_name: Option<String>,
    pub min_date: Option<String>,
    pub max_date: Option<String>,
    pub limit: Option<u32>,
    pub page: Option<u32>,
}

impl Query for ReceiptQuery {
    fn add_to_url(&self, url: &mut Url) {
        if let Some(committee_id) = &self.committee_id {
            url.query_pairs_mut()
                .append_pair("committee_id", committee_id);
        }
        if let Some(contributor_name) = &self.contributor_name {
            url.query_pairs_mut()
                .append_pair("contributor_name", contributor_name);
        }
        if let Some(min_date) = &self.min_date {
            url.query_pairs_mut().append_pair("min_date", min_date);
        }
        if let Some(max_date) = &self.max_date {
            url.query_pairs_mut().append_pair("max_date", max_date);
        }
        if let Some(limit) = self.limit {
            url.query_pairs_mut()
                .append_pair("per_page", &limit.to_string());
        }
        if let Some(page) = self.page {
            url.query_pairs_mut().append_pair("page", &page.to_string());
        }
    }
}

impl ReceiptQuery {
    pub fn with_committee_id(mut self, committee_id: String) -> Self {
        self.committee_id = Some(committee_id);
        self
    }

    pub fn with_contributor_name(mut self, name: String) -> Self {
        self.contributor_name = Some(name);
        self
    }

    pub fn with_limit(mut self, limit: u32) -> Self {
        self.limit = Some(limit);
        self
    }
}
