// Schema constants, enum names, and ID builders.

// ── PostgreSQL enum type names ─────────────────────────────────────────────

/// Status values for source ingestion runs.
pub const SOURCE_RUN_STATUS_ENUM: &str = "source_run_status";

/// Confidence levels for data provenance.
pub const CONFIDENCE_LEVEL_ENUM: &str = "confidence_level";

/// Transaction types tracked in FEC receipts/disbursements.
pub const FEC_TRANSACTION_TYPE_ENUM: &str = "fec_transaction_type";

/// Roles an influence-network committee can hold.
pub const INFLUENCE_COMMITTEE_ROLE_ENUM: &str = "influence_committee_role";

// ── Entity type constants ──────────────────────────────────────────────────

pub const ENTITY_TYPE_MEMBER: &str = "member";
pub const ENTITY_TYPE_COMMITTEE: &str = "committee";
pub const ENTITY_TYPE_CANDIDATE: &str = "candidate";
pub const ENTITY_TYPE_LOBBYIST: &str = "lobbyist";

// ── Source type constants ──────────────────────────────────────────────────

pub const SOURCE_UNITEDSTATES: &str = "unitedstates_legislators";
pub const SOURCE_CONGRESS_GOV: &str = "congress_gov";
pub const SOURCE_OPENFEC: &str = "openfec";
pub const SOURCE_LDA: &str = "lda";
pub const SOURCE_VOTEVIEW: &str = "voteview";
pub const SOURCE_CAPITOLTRADES: &str = "capitoltrades";
pub const SOURCE_CIVIQ: &str = "civiq";
pub const SOURCE_WIKIDATA: &str = "wikidata";
pub const SOURCE_MANUAL: &str = "manual_influence_seed";

// ── ID scheme constants ────────────────────────────────────────────────────

pub const SCHEME_BIOGUIDE: &str = "bioguide";
pub const SCHEME_FEC: &str = "fec";
pub const SCHEME_ICPSR: &str = "icpsr";
pub const SCHEME_OPENSECRETS: &str = "opensecrets";
pub const SCHEME_WIKIDATA: &str = "wikidata";
pub const SCHEME_BALLOTPEDIA: &str = "ballotpedia";
pub const SCHEME_GOVTRACK: &str = "govtrack";
pub const SCHEME_VOTESMART: &str = "votesmart";
pub const SCHEME_CSPAN: &str = "cspan";

// ── ID builders ────────────────────────────────────────────────────────────

/// Build a canonical bill identifier in the form `{bill_type}{bill_number}-{congress}`
/// (e.g. `"hr1-119"`).
///
/// Bill type is normalized to lowercase.
pub fn build_bill_id(congress: i32, bill_type: &str, bill_number: i32) -> String {
    format!("{}{}-{}", bill_type.to_lowercase(), bill_number, congress)
}

/// Build a canonical roll-call vote identifier in the form `{congress}-{chamber}-{roll_number}`
/// (e.g. `"119-house-42"`).
///
/// Chamber is normalized to lowercase.
pub fn build_vote_id(congress: i32, chamber: &str, roll_number: i32) -> String {
    format!("{}-{}-{}", congress, chamber.to_lowercase(), roll_number)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_bill_id() {
        assert_eq!(build_bill_id(119, "HR", 1), "hr1-119");
        assert_eq!(build_bill_id(118, "s", 1234), "s1234-118");
        assert_eq!(build_bill_id(117, "hjres", 31), "hjres31-117");
    }

    #[test]
    fn test_build_vote_id() {
        assert_eq!(build_vote_id(119, "House", 42), "119-house-42");
        assert_eq!(build_vote_id(118, "Senate", 1), "118-senate-1");
    }
}
