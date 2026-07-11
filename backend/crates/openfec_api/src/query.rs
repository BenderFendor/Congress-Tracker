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
    pub candidate_id: Option<String>,
    pub cycle: Option<u32>,
    pub q: Option<String>,
    pub sort: Option<String>,
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
        if let Some(candidate_id) = &self.candidate_id {
            url.query_pairs_mut()
                .append_pair("candidate_id", candidate_id);
        }
        if let Some(cycle) = self.cycle {
            url.query_pairs_mut()
                .append_pair("cycle", &cycle.to_string());
        }
        if let Some(q) = &self.q {
            url.query_pairs_mut().append_pair("q", q);
        }
        if let Some(sort) = &self.sort {
            url.query_pairs_mut().append_pair("sort", sort);
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

    pub fn with_candidate_id(mut self, candidate_id: String) -> Self {
        self.candidate_id = Some(candidate_id);
        self
    }

    pub fn with_cycle(mut self, cycle: u32) -> Self {
        self.cycle = Some(cycle);
        self
    }

    pub fn with_q(mut self, q: String) -> Self {
        self.q = Some(q);
        self
    }

    pub fn with_sort(mut self, sort: String) -> Self {
        self.sort = Some(sort);
        self
    }

    pub fn with_limit(mut self, limit: u32) -> Self {
        self.limit = Some(limit);
        self
    }

    pub fn with_page(mut self, page: u32) -> Self {
        self.page = Some(page);
        self
    }
}

#[derive(Default)]
pub struct CommitteeQuery {
    pub name: Option<String>,
    pub state: Option<String>,
    pub committee_type: Option<String>,
    pub committee_id: Option<String>,
    pub candidate_id: Option<String>,
    pub cycle: Option<u32>,
    pub q: Option<String>,
    pub designation: Option<String>,
    pub sort: Option<String>,
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
        if let Some(committee_id) = &self.committee_id {
            url.query_pairs_mut()
                .append_pair("committee_id", committee_id);
        }
        if let Some(candidate_id) = &self.candidate_id {
            url.query_pairs_mut()
                .append_pair("candidate_id", candidate_id);
        }
        if let Some(cycle) = self.cycle {
            url.query_pairs_mut()
                .append_pair("cycle", &cycle.to_string());
        }
        if let Some(q) = &self.q {
            url.query_pairs_mut().append_pair("q", q);
        }
        if let Some(designation) = &self.designation {
            url.query_pairs_mut()
                .append_pair("designation", designation);
        }
        if let Some(sort) = &self.sort {
            url.query_pairs_mut().append_pair("sort", sort);
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

    pub fn with_committee_id(mut self, committee_id: String) -> Self {
        self.committee_id = Some(committee_id);
        self
    }

    pub fn with_candidate_id(mut self, candidate_id: String) -> Self {
        self.candidate_id = Some(candidate_id);
        self
    }

    pub fn with_cycle(mut self, cycle: u32) -> Self {
        self.cycle = Some(cycle);
        self
    }

    pub fn with_q(mut self, q: String) -> Self {
        self.q = Some(q);
        self
    }

    pub fn with_designation(mut self, designation: String) -> Self {
        self.designation = Some(designation);
        self
    }

    pub fn with_sort(mut self, sort: String) -> Self {
        self.sort = Some(sort);
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
    pub candidate_id: Option<String>,
    pub contributor_committee_id: Option<String>,
    pub min_date: Option<String>,
    pub max_date: Option<String>,
    pub cycle: Option<u32>,
    pub sort: Option<String>,
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
        if let Some(candidate_id) = &self.candidate_id {
            url.query_pairs_mut()
                .append_pair("candidate_id", candidate_id);
        }
        if let Some(contributor_committee_id) = &self.contributor_committee_id {
            url.query_pairs_mut()
                .append_pair("contributor_committee_id", contributor_committee_id);
        }
        if let Some(min_date) = &self.min_date {
            url.query_pairs_mut().append_pair("min_date", min_date);
        }
        if let Some(max_date) = &self.max_date {
            url.query_pairs_mut().append_pair("max_date", max_date);
        }
        if let Some(cycle) = self.cycle {
            url.query_pairs_mut()
                .append_pair("cycle", &cycle.to_string());
        }
        if let Some(sort) = &self.sort {
            url.query_pairs_mut().append_pair("sort", sort);
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

    pub fn with_candidate_id(mut self, candidate_id: String) -> Self {
        self.candidate_id = Some(candidate_id);
        self
    }

    pub fn with_contributor_committee_id(mut self, id: String) -> Self {
        self.contributor_committee_id = Some(id);
        self
    }

    pub fn with_min_date(mut self, date: String) -> Self {
        self.min_date = Some(date);
        self
    }

    pub fn with_max_date(mut self, date: String) -> Self {
        self.max_date = Some(date);
        self
    }

    pub fn with_cycle(mut self, cycle: u32) -> Self {
        self.cycle = Some(cycle);
        self
    }

    pub fn with_sort(mut self, sort: String) -> Self {
        self.sort = Some(sort);
        self
    }

    pub fn with_limit(mut self, limit: u32) -> Self {
        self.limit = Some(limit);
        self
    }
}

#[derive(Default)]
pub struct IndependentExpenditureQuery {
    pub candidate_id: Option<String>,
    pub committee_id: Option<String>,
    pub cycle: Option<u32>,
    pub support_oppose: Option<String>,
    pub limit: Option<u32>,
    pub page: Option<u32>,
}

impl Query for IndependentExpenditureQuery {
    fn add_to_url(&self, url: &mut Url) {
        if let Some(candidate_id) = &self.candidate_id {
            url.query_pairs_mut()
                .append_pair("candidate_id", candidate_id);
        }
        if let Some(committee_id) = &self.committee_id {
            url.query_pairs_mut()
                .append_pair("committee_id", committee_id);
        }
        if let Some(cycle) = self.cycle {
            url.query_pairs_mut()
                .append_pair("cycle", &cycle.to_string());
        }
        if let Some(support_oppose) = &self.support_oppose {
            url.query_pairs_mut()
                .append_pair("support_oppose_indicator", support_oppose);
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

impl IndependentExpenditureQuery {
    pub fn with_candidate_id(mut self, candidate_id: String) -> Self {
        self.candidate_id = Some(candidate_id);
        self
    }

    pub fn with_committee_id(mut self, committee_id: String) -> Self {
        self.committee_id = Some(committee_id);
        self
    }

    pub fn with_cycle(mut self, cycle: u32) -> Self {
        self.cycle = Some(cycle);
        self
    }

    pub fn with_support_oppose(mut self, val: String) -> Self {
        self.support_oppose = Some(val);
        self
    }

    pub fn with_limit(mut self, limit: u32) -> Self {
        self.limit = Some(limit);
        self
    }
}

#[derive(Default)]
pub struct CandidateTotalQuery {
    pub candidate_id: Option<String>,
    pub cycle: Option<u32>,
    pub limit: Option<u32>,
    pub page: Option<u32>,
}

impl Query for CandidateTotalQuery {
    fn add_to_url(&self, url: &mut Url) {
        if let Some(candidate_id) = &self.candidate_id {
            url.query_pairs_mut()
                .append_pair("candidate_id", candidate_id);
        }
        if let Some(cycle) = self.cycle {
            url.query_pairs_mut()
                .append_pair("cycle", &cycle.to_string());
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

impl CandidateTotalQuery {
    pub fn with_candidate_id(mut self, candidate_id: String) -> Self {
        self.candidate_id = Some(candidate_id);
        self
    }

    pub fn with_cycle(mut self, cycle: u32) -> Self {
        self.cycle = Some(cycle);
        self
    }

    pub fn with_limit(mut self, limit: u32) -> Self {
        self.limit = Some(limit);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::{CandidateQuery, Query};
    use url::Url;

    #[test]
    fn candidate_query_serializes_bounded_page_parameters() {
        let query = CandidateQuery::default()
            .with_cycle(2026)
            .with_limit(100)
            .with_page(2);
        let mut url = Url::parse("https://api.open.fec.gov/v1/candidates/").unwrap();

        query.add_to_url(&mut url);

        let pairs = url.query_pairs().collect::<Vec<_>>();
        assert!(pairs.contains(&("cycle".into(), "2026".into())));
        assert!(pairs.contains(&("per_page".into(), "100".into())));
        assert!(pairs.contains(&("page".into(), "2".into())));
    }
}
