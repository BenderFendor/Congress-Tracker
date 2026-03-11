use url::Url;

pub trait Query {
    fn add_to_url(&self, url: &mut Url);
}

#[derive(Default)]
pub struct BillQuery {
    pub congress: Option<u32>,
    pub chamber: Option<String>,
    pub bill_type: Option<String>,
    pub member: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

impl Query for BillQuery {
    fn add_to_url(&self, url: &mut Url) {
        if let Some(congress) = self.congress {
            url.query_pairs_mut()
                .append_pair("congress", &congress.to_string());
        }
        if let Some(chamber) = &self.chamber {
            url.query_pairs_mut().append_pair("chamber", chamber);
        }
        if let Some(bill_type) = &self.bill_type {
            url.query_pairs_mut().append_pair("bill_type", bill_type);
        }
        if let Some(member) = &self.member {
            url.query_pairs_mut().append_pair("member", member);
        }
        if let Some(limit) = self.limit {
            url.query_pairs_mut()
                .append_pair("limit", &limit.to_string());
        }
        if let Some(offset) = self.offset {
            url.query_pairs_mut()
                .append_pair("offset", &offset.to_string());
        }
    }
}

impl BillQuery {
    pub fn with_congress(mut self, congress: u32) -> Self {
        self.congress = Some(congress);
        self
    }

    pub fn with_chamber(mut self, chamber: String) -> Self {
        self.chamber = Some(chamber);
        self
    }

    pub fn with_member(mut self, member: String) -> Self {
        self.member = Some(member);
        self
    }

    pub fn with_limit(mut self, limit: u32) -> Self {
        self.limit = Some(limit);
        self
    }
}

#[derive(Default)]
pub struct MemberQuery {
    pub state: Option<String>,
    pub district: Option<String>,
    pub chamber: Option<String>,
    pub party: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

impl Query for MemberQuery {
    fn add_to_url(&self, url: &mut Url) {
        if let Some(state) = &self.state {
            url.query_pairs_mut().append_pair("state", state);
        }
        if let Some(district) = &self.district {
            url.query_pairs_mut().append_pair("district", district);
        }
        if let Some(chamber) = &self.chamber {
            url.query_pairs_mut().append_pair("chamber", chamber);
        }
        if let Some(party) = &self.party {
            url.query_pairs_mut().append_pair("party", party);
        }
        if let Some(limit) = self.limit {
            url.query_pairs_mut()
                .append_pair("limit", &limit.to_string());
        }
        if let Some(offset) = self.offset {
            url.query_pairs_mut()
                .append_pair("offset", &offset.to_string());
        }
    }
}

impl MemberQuery {
    pub fn with_state(mut self, state: String) -> Self {
        self.state = Some(state);
        self
    }

    pub fn with_district(mut self, district: String) -> Self {
        self.district = Some(district);
        self
    }

    pub fn with_limit(mut self, limit: u32) -> Self {
        self.limit = Some(limit);
        self
    }
}

#[derive(Default)]
pub struct VoteQuery {
    pub congress: Option<u32>,
    pub chamber: Option<String>,
    pub bill: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

impl Query for VoteQuery {
    fn add_to_url(&self, url: &mut Url) {
        if let Some(congress) = self.congress {
            url.query_pairs_mut()
                .append_pair("congress", &congress.to_string());
        }
        if let Some(chamber) = &self.chamber {
            url.query_pairs_mut().append_pair("chamber", chamber);
        }
        if let Some(bill) = &self.bill {
            url.query_pairs_mut().append_pair("bill", bill);
        }
        if let Some(limit) = self.limit {
            url.query_pairs_mut()
                .append_pair("limit", &limit.to_string());
        }
        if let Some(offset) = self.offset {
            url.query_pairs_mut()
                .append_pair("offset", &offset.to_string());
        }
    }
}
