//! Cross-API value normalization.
//!
//! Different APIs use different encodings for the same concepts. Congress.gov
//! returns `"Democratic"` as `partyName`; OpenFEC returns `"DEM"`; unitedstates
//! returns `"Democrat"`. Without normalization, cross-source joins silently fail,
//! entity resolution misses matches, and dashboards double-count the same party.
//!
//! Every ingest boundary and every comparison MUST normalize these fields to a
//! single canonical form before writing or comparing.

/// Maps any known party variant to its canonical form.
///
/// # Evidence
/// - Congress.gov `partyName`: `"Democratic"`, `"Republican"`, `"Independent"`
/// - OpenFEC `party`: `"DEM"`, `"REP"`, `"IND"` (3-char codes)
/// - unitedstates/congress-legislators: `"Democrat"`, `"Republican"`
pub fn normalize_party(raw: &str) -> String {
    match raw.trim().to_lowercase().as_str() {
        "dem" => "Democratic",
        "rep" => "Republican",
        "ind" => "Independent",
        "lib" => "Libertarian",
        "gre" => "Green",
        "non" => "Non-Party",
        "democrat" | "democratic" | "democratic party" => "Democratic",
        "republican" | "republican party" => "Republican",
        "independent" | "independent party" => "Independent",
        "libertarian" | "libertarian party" => "Libertarian",
        "green" | "green party" => "Green",
        other => return other.to_uppercase(),
    }
    .to_string()
}

/// Maps chamber names to canonical `"House"` or `"Senate"`.
///
/// # Evidence
/// - Congress.gov: `"House"`, `"Senate"`
/// - unitedstates/congress-legislators: `"house"`, `"senate"` (lowercase)
pub fn normalize_chamber(raw: &str) -> String {
    match raw.trim().to_lowercase().as_str() {
        "house" | "house of representatives" | "h" | "lower" => "House",
        "senate" | "s" | "upper" => "Senate",
        other => return other.to_uppercase(),
    }
    .to_string()
}

/// Maps state names to 2-letter postal abbreviations.
///
/// # Evidence
/// - Congress.gov `state`: 2-letter postal code
/// - OpenFEC `state`: 2-letter postal code
/// - unitedstates/congress-legislators: 2-letter postal code
/// - Some secondary sources may use full state names
pub fn normalize_state(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.len() == 2 && trimmed.chars().all(|c| c.is_ascii_alphabetic()) {
        return trimmed.to_uppercase();
    }
    match trimmed.to_lowercase().as_str() {
        "alabama" => "AL",
        "alaska" => "AK",
        "arizona" => "AZ",
        "arkansas" => "AR",
        "california" => "CA",
        "colorado" => "CO",
        "connecticut" => "CT",
        "delaware" => "DE",
        "florida" => "FL",
        "georgia" => "GA",
        "hawaii" => "HI",
        "idaho" => "ID",
        "illinois" => "IL",
        "indiana" => "IN",
        "iowa" => "IA",
        "kansas" => "KS",
        "kentucky" => "KY",
        "louisiana" => "LA",
        "maine" => "ME",
        "maryland" => "MD",
        "massachusetts" => "MA",
        "michigan" => "MI",
        "minnesota" => "MN",
        "mississippi" => "MS",
        "missouri" => "MO",
        "montana" => "MT",
        "nebraska" => "NE",
        "nevada" => "NV",
        "new hampshire" => "NH",
        "new jersey" => "NJ",
        "new mexico" => "NM",
        "new york" => "NY",
        "north carolina" => "NC",
        "north dakota" => "ND",
        "ohio" => "OH",
        "oklahoma" => "OK",
        "oregon" => "OR",
        "pennsylvania" => "PA",
        "rhode island" => "RI",
        "south carolina" => "SC",
        "south dakota" => "SD",
        "tennessee" => "TN",
        "texas" => "TX",
        "utah" => "UT",
        "vermont" => "VT",
        "virginia" => "VA",
        "washington" => "WA",
        "west virginia" => "WV",
        "wisconsin" => "WI",
        "wyoming" => "WY",
        "district of columbia" | "washington dc" | "washington d.c." => "DC",
        "american samoa" => "AS",
        "guam" => "GU",
        "northern mariana islands" | "northern marianas" => "MP",
        "puerto rico" => "PR",
        "us virgin islands" | "virgin islands" | "u.s. virgin islands" => "VI",
        other => return other.to_uppercase(),
    }
    .to_string()
}

/// Normalize vote position strings to canonical form.
///
/// # Evidence
/// - Congress.gov vote positions use `"Yea"`, `"Nay"`, `"Present"`, `"Not Voting"`
/// - Voteview may use `"Yea"`/`"Nay"` variants
/// - unitedstates/congress may use `"Aye"`/`"No"` variants
pub fn normalize_vote_position(raw: &str) -> String {
    match raw.trim().to_lowercase().as_str() {
        "yea" | "yes" | "aye" | "y" => "Yes",
        "nay" | "no" | "n" => "No",
        "present" | "p" => "Present",
        "not voting" | "not_voting" | "nv" => "Not Voting",
        other => return other.to_uppercase(),
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_party_normalization() {
        assert_eq!(normalize_party("DEM"), "Democratic");
        assert_eq!(normalize_party("REP"), "Republican");
        assert_eq!(normalize_party("IND"), "Independent");
        assert_eq!(normalize_party("Democrat"), "Democratic");
        assert_eq!(normalize_party("Democratic"), "Democratic");
        assert_eq!(normalize_party("republican party"), "Republican");
        assert_eq!(normalize_party("dem"), "Democratic");
        assert_eq!(normalize_party("rep"), "Republican");
        assert_eq!(normalize_party("Whig"), "WHIG");
    }

    #[test]
    fn test_chamber_normalization() {
        assert_eq!(normalize_chamber("House"), "House");
        assert_eq!(normalize_chamber("house"), "House");
        assert_eq!(normalize_chamber("House of Representatives"), "House");
        assert_eq!(normalize_chamber("Senate"), "Senate");
        assert_eq!(normalize_chamber("senate"), "Senate");
        assert_eq!(normalize_chamber("Upper"), "Senate");
        assert_eq!(normalize_chamber("Joint"), "JOINT");
    }

    #[test]
    fn test_state_normalization() {
        assert_eq!(normalize_state("CA"), "CA");
        assert_eq!(normalize_state("ca"), "CA");
        assert_eq!(normalize_state("ny"), "NY");
        assert_eq!(normalize_state("California"), "CA");
        assert_eq!(normalize_state("New York"), "NY");
        assert_eq!(normalize_state("District of Columbia"), "DC");
        assert_eq!(normalize_state("Washington DC"), "DC");
    }

    #[test]
    fn test_vote_position_normalization() {
        assert_eq!(normalize_vote_position("Yea"), "Yes");
        assert_eq!(normalize_vote_position("Yes"), "Yes");
        assert_eq!(normalize_vote_position("aye"), "Yes");
        assert_eq!(normalize_vote_position("Nay"), "No");
        assert_eq!(normalize_vote_position("No"), "No");
        assert_eq!(normalize_vote_position("Present"), "Present");
        assert_eq!(normalize_vote_position("Not Voting"), "Not Voting");
    }
}
