//! Pipe-delimited FEC bulk data file parser.
//!
//! FEC bulk ZIPs contain pipe-delimited (`|`) text files. Fields are NOT
//! quoted (unlike CSV), and each line corresponds to one record. Columns
//! are positional and documented on fec.gov.
//!
//! Each parser function reads from a pre-extracted byte slice (from a ZIP
//! entry), splits on newlines and pipes, and yields records.

use crate::fec_bulk::{self, parse_amount, parse_fec_date, parse_int};
use chrono::NaiveDate;

// ── Parsed row types ──────────────────────────────────────────────────

/// A single row from the `indiv` (individual contributions) file.
#[derive(Debug, Clone)]
pub struct RawIndividualReceipt {
    pub sub_id: i64,
    pub committee_id: String,
    pub amendment_ind: Option<String>,
    pub report_type: Option<String>,
    pub transaction_pgi: Option<String>,
    pub image_num: Option<String>,
    pub transaction_type: Option<String>,
    pub entity_type: Option<String>,
    pub contributor_name: Option<String>,
    pub contributor_city: Option<String>,
    pub contributor_state: Option<String>,
    pub contributor_zip: Option<String>,
    pub contributor_employer: Option<String>,
    pub contributor_occupation: Option<String>,
    pub transaction_date: Option<NaiveDate>,
    pub transaction_amount: f64,
    pub other_id: Option<String>,
    pub tran_id: Option<String>,
    pub filing_num: Option<i64>,
    pub memo_code: Option<String>,
    pub memo_text: Option<String>,
}

/// A single row from the `oth` (committee transactions) file.
#[derive(Debug, Clone)]
pub struct RawCommitteeTxn {
    pub sub_id: i64,
    pub committee_id: String,
    pub amendment_ind: Option<String>,
    pub report_type: Option<String>,
    pub transaction_pgi: Option<String>,
    pub image_num: Option<String>,
    pub transaction_type: Option<String>,
    pub entity_type: Option<String>,
    pub contributor_name: Option<String>,
    pub contributor_city: Option<String>,
    pub contributor_state: Option<String>,
    pub contributor_zip: Option<String>,
    pub contributor_employer: Option<String>,
    pub contributor_occupation: Option<String>,
    pub transaction_date: Option<NaiveDate>,
    pub transaction_amount: f64,
    pub other_id: Option<String>,
    pub tran_id: Option<String>,
    pub filing_num: Option<i64>,
    pub memo_code: Option<String>,
    pub memo_text: Option<String>,
}

/// A single row from the `cm` (committee master) file.
#[derive(Debug, Clone)]
pub struct CommitteeMasterRow {
    pub committee_id: String,
    pub name: Option<String>,
    pub treasurer_name: Option<String>,
    pub street1: Option<String>,
    pub street2: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub zip: Option<String>,
    pub designation: Option<String>,
    pub committee_type: Option<String>,
    pub party: Option<String>,
    pub filing_freq: Option<String>,
    pub org_type: Option<String>,
    pub connected_org: Option<String>,
    pub candidate_id: Option<String>,
}

/// A single row from the `ccl` (candidate-committee linkage) file.
#[derive(Debug, Clone)]
pub struct CclRow {
    pub candidate_id: String,
    pub candidate_election_year: Option<i32>,
    pub fec_election_year: Option<i32>,
    pub committee_id: String,
    pub committee_type: Option<String>,
    pub committee_designation: Option<String>,
    pub linkage_id: Option<i64>,
}

impl CclRow {
    /// The active two-year FEC period is authoritative for cycle-scoped imports.
    pub fn election_cycle(&self) -> Option<i32> {
        self.fec_election_year.or(self.candidate_election_year)
    }
}

/// A single row from the `cn` candidate master file.
#[derive(Debug, Clone)]
pub struct CandidateMasterRow {
    pub candidate_id: String,
    pub name: String,
    pub party: Option<String>,
    pub election_year: Option<i32>,
    pub office_state: Option<String>,
    pub office: Option<String>,
    pub district: Option<String>,
    pub incumbent_challenge: Option<String>,
    pub status: Option<String>,
    pub principal_committee_id: Option<String>,
    pub street1: Option<String>,
    pub street2: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub zip: Option<String>,
}

// ── Parsing helpers ───────────────────────────────────────────────────

/// Parse the raw text content of an FEC pipe-delimited file.
///
/// `lines` is the full file text, split per line. The first line is a
/// header and is skipped. Each subsequent line is split on `|` and fed to
/// `row_parser`, which maps column slice indices to a parsed row.
///
/// Returns the parsed rows plus a count of skipped (malformed) lines.
pub fn parse_pipe_delimited<T>(
    text: &str,
    expected_columns: usize,
    mut row_parser: impl FnMut(&[&str]) -> Option<T>,
) -> (Vec<T>, usize) {
    let mut rows = Vec::new();
    let mut skipped = 0usize;

    for (lineno, line) in text.lines().enumerate() {
        let line = line.trim_end_matches('\r');
        if line.is_empty() {
            continue;
        }
        // Skip header line (first line, usually uppercase codes)
        if lineno == 0 && (line.contains("CMTE_ID") || line.starts_with("CAND_ID")) {
            continue;
        }

        let fields: Vec<&str> = line.split('|').collect();
        if fields.len() < expected_columns {
            skipped += 1;
            continue;
        }
        match row_parser(&fields) {
            Some(row) => rows.push(row),
            None => skipped += 1,
        }
    }

    (rows, skipped)
}

/// Parse an `indiv` file content into structured rows.
pub fn parse_individuals(text: &str) -> (Vec<RawIndividualReceipt>, usize) {
    parse_pipe_delimited(text, 21, parse_individual_fields)
}

/// Parse one headerless `indiv` source line for the streaming pipeline.
pub fn parse_individual_line(line: &str) -> Option<RawIndividualReceipt> {
    let fields: Vec<&str> = line.split('|').collect();
    (fields.len() >= 21)
        .then(|| parse_individual_fields(&fields))
        .flatten()
}

fn parse_individual_fields(fields: &[&str]) -> Option<RawIndividualReceipt> {
    Some(RawIndividualReceipt {
        sub_id: parse_int(fields[fec_bulk::indiv_columns::SUB_ID])?,
        committee_id: fields[fec_bulk::indiv_columns::CMTE_ID].to_string(),
        amendment_ind: opt_str(fields[fec_bulk::indiv_columns::AMNDT_IND]),
        report_type: opt_str(fields[fec_bulk::indiv_columns::RPT_TP]),
        transaction_pgi: opt_str(fields[fec_bulk::indiv_columns::TRANSACTION_PGI]),
        image_num: opt_str(fields[fec_bulk::indiv_columns::IMAGE_NUM]),
        transaction_type: opt_str(fields[fec_bulk::indiv_columns::TRANSACTION_TP]),
        entity_type: opt_str(fields[fec_bulk::indiv_columns::ENTITY_TP]),
        contributor_name: opt_str(fields[fec_bulk::indiv_columns::NAME]),
        contributor_city: opt_str(fields[fec_bulk::indiv_columns::CITY]),
        contributor_state: opt_str(fields[fec_bulk::indiv_columns::STATE]),
        contributor_zip: opt_str(fields[fec_bulk::indiv_columns::ZIP_CODE]),
        contributor_employer: opt_str(fields[fec_bulk::indiv_columns::EMPLOYER]),
        contributor_occupation: opt_str(fields[fec_bulk::indiv_columns::OCCUPATION]),
        transaction_date: parse_fec_date(fields[fec_bulk::indiv_columns::TRANSACTION_DT]),
        transaction_amount: parse_amount(fields[fec_bulk::indiv_columns::TRANSACTION_AMT])?,
        other_id: opt_str(fields[fec_bulk::indiv_columns::OTHER_ID]),
        tran_id: opt_str(fields[fec_bulk::indiv_columns::TRAN_ID]),
        filing_num: parse_int(fields[fec_bulk::indiv_columns::FILE_NUM]),
        memo_code: opt_str(fields[fec_bulk::indiv_columns::MEMO_CD]),
        memo_text: opt_str(fields[fec_bulk::indiv_columns::MEMO_TEXT]),
    })
}

/// Parse an `oth` file content into structured rows (same layout as indiv).
pub fn parse_committee_txns(text: &str) -> (Vec<RawCommitteeTxn>, usize) {
    parse_pipe_delimited(text, 21, parse_committee_txn_fields)
}

/// Parse one headerless `oth` source line for the streaming pipeline.
pub fn parse_committee_txn_line(line: &str) -> Option<RawCommitteeTxn> {
    let fields: Vec<&str> = line.split('|').collect();
    (fields.len() >= 21)
        .then(|| parse_committee_txn_fields(&fields))
        .flatten()
}

fn parse_committee_txn_fields(fields: &[&str]) -> Option<RawCommitteeTxn> {
    Some(RawCommitteeTxn {
        sub_id: parse_int(fields[fec_bulk::oth_columns::SUB_ID])?,
        committee_id: fields[fec_bulk::oth_columns::CMTE_ID].to_string(),
        amendment_ind: opt_str(fields[fec_bulk::oth_columns::AMNDT_IND]),
        report_type: opt_str(fields[fec_bulk::oth_columns::RPT_TP]),
        transaction_pgi: opt_str(fields[fec_bulk::oth_columns::TRANSACTION_PGI]),
        image_num: opt_str(fields[fec_bulk::oth_columns::IMAGE_NUM]),
        transaction_type: opt_str(fields[fec_bulk::oth_columns::TRANSACTION_TP]),
        entity_type: opt_str(fields[fec_bulk::oth_columns::ENTITY_TP]),
        contributor_name: opt_str(fields[fec_bulk::oth_columns::NAME]),
        contributor_city: opt_str(fields[fec_bulk::oth_columns::CITY]),
        contributor_state: opt_str(fields[fec_bulk::oth_columns::STATE]),
        contributor_zip: opt_str(fields[fec_bulk::oth_columns::ZIP_CODE]),
        contributor_employer: opt_str(fields[fec_bulk::oth_columns::EMPLOYER]),
        contributor_occupation: opt_str(fields[fec_bulk::oth_columns::OCCUPATION]),
        transaction_date: parse_fec_date(fields[fec_bulk::oth_columns::TRANSACTION_DT]),
        transaction_amount: parse_amount(fields[fec_bulk::oth_columns::TRANSACTION_AMT])?,
        other_id: opt_str(fields[fec_bulk::oth_columns::OTHER_ID]),
        tran_id: opt_str(fields[fec_bulk::oth_columns::TRAN_ID]),
        filing_num: parse_int(fields[fec_bulk::oth_columns::FILE_NUM]),
        memo_code: opt_str(fields[fec_bulk::oth_columns::MEMO_CD]),
        memo_text: opt_str(fields[fec_bulk::oth_columns::MEMO_TEXT]),
    })
}

/// Parse a `cm` (committee master) file.
pub fn parse_committee_master(text: &str) -> (Vec<CommitteeMasterRow>, usize) {
    parse_pipe_delimited(text, 15, |f| {
        Some(CommitteeMasterRow {
            committee_id: f[fec_bulk::cm_columns::CMTE_ID].to_string(),
            name: opt_str(f[fec_bulk::cm_columns::CMTE_NM]),
            treasurer_name: opt_str(f[fec_bulk::cm_columns::TRES_NM]),
            street1: opt_str(f[fec_bulk::cm_columns::CMTE_ST1]),
            street2: opt_str(f[fec_bulk::cm_columns::CMTE_ST2]),
            city: opt_str(f[fec_bulk::cm_columns::CMTE_CITY]),
            state: opt_str(f[fec_bulk::cm_columns::CMTE_ST]),
            zip: opt_str(f[fec_bulk::cm_columns::CMTE_ZIP]),
            designation: opt_str(f[fec_bulk::cm_columns::CMTE_DSGN]),
            committee_type: opt_str(f[fec_bulk::cm_columns::CMTE_TP]),
            party: opt_str(f[fec_bulk::cm_columns::CMTE_PTY_AFFILIATION]),
            filing_freq: opt_str(f[fec_bulk::cm_columns::CMTE_FILING_FREQ]),
            org_type: opt_str(f[fec_bulk::cm_columns::ORG_TP]),
            connected_org: opt_str(f[fec_bulk::cm_columns::CONNECTED_ORG_NM]),
            candidate_id: opt_str(f[fec_bulk::cm_columns::CAND_ID]),
        })
    })
}

/// Parse a `cn` (candidate master) file using the official 15-column layout.
pub fn parse_candidate_master(text: &str) -> (Vec<CandidateMasterRow>, usize) {
    parse_pipe_delimited(text, 15, |f| {
        Some(CandidateMasterRow {
            candidate_id: f[fec_bulk::cn_columns::CAND_ID].to_string(),
            name: opt_str(f[fec_bulk::cn_columns::CAND_NAME])?,
            party: opt_str(f[fec_bulk::cn_columns::CAND_PTY_AFFILIATION]),
            election_year: parse_int(f[fec_bulk::cn_columns::CAND_ELECTION_YR])
                .map(|value| value as i32),
            office_state: opt_str(f[fec_bulk::cn_columns::CAND_OFFICE_ST]),
            office: opt_str(f[fec_bulk::cn_columns::CAND_OFFICE]),
            district: opt_str(f[fec_bulk::cn_columns::CAND_OFFICE_DISTRICT]),
            incumbent_challenge: opt_str(f[fec_bulk::cn_columns::CAND_ICI]),
            status: opt_str(f[fec_bulk::cn_columns::CAND_STATUS]),
            principal_committee_id: opt_str(f[fec_bulk::cn_columns::CAND_PCC]),
            street1: opt_str(f[fec_bulk::cn_columns::CAND_ST1]),
            street2: opt_str(f[fec_bulk::cn_columns::CAND_ST2]),
            city: opt_str(f[fec_bulk::cn_columns::CAND_CITY]),
            state: opt_str(f[fec_bulk::cn_columns::CAND_ST]),
            zip: opt_str(f[fec_bulk::cn_columns::CAND_ZIP]),
        })
    })
}

/// Parse a `ccl` (candidate-committee linkage) file.
pub fn parse_ccl(text: &str) -> (Vec<CclRow>, usize) {
    parse_pipe_delimited(text, 7, |f| {
        Some(CclRow {
            candidate_id: f[fec_bulk::ccl_columns::CAND_ID].to_string(),
            candidate_election_year: parse_int(f[fec_bulk::ccl_columns::CAND_ELECTION_YR])
                .map(|v| v as i32),
            fec_election_year: parse_int(f[fec_bulk::ccl_columns::FEC_ELECTION_YR])
                .map(|v| v as i32),
            committee_id: f[fec_bulk::ccl_columns::CMTE_ID].to_string(),
            committee_type: opt_str(f[fec_bulk::ccl_columns::CMTE_TP]),
            committee_designation: opt_str(f[fec_bulk::ccl_columns::CMTE_DSGN]),
            linkage_id: parse_int(f[fec_bulk::ccl_columns::LINKAGE_ID]),
        })
    })
}

/// Extract the text content of a named file inside a ZIP archive.
pub fn extract_zip_entry(zip_bytes: &[u8], entry_name: &str) -> Result<String, ParseError> {
    use std::io::Read;

    let mut archive =
        zip::ZipArchive::new(std::io::Cursor::new(zip_bytes)).map_err(|e| ParseError::Zip {
            context: "opening archive".to_string(),
            source: e,
        })?;

    // Find the actual entry name (try exact first, then case-insensitive)
    let actual_name = if archive.by_name(entry_name).is_ok() {
        // File is readable directly, drop the result and use entry_name
        entry_name.to_string()
    } else {
        // Case-insensitive fallback: search for a matching name
        let names: Vec<String> = archive.file_names().map(|n| n.to_string()).collect();
        let found = names.iter().find(|n| n.eq_ignore_ascii_case(entry_name));
        match found {
            Some(name) => name.clone(),
            None => {
                return Err(ParseError::EntryNotFound {
                    entry: entry_name.to_string(),
                    available: names,
                })
            }
        }
    };

    let mut file = archive.by_name(&actual_name).map_err(|e| ParseError::Zip {
        context: format!("reading entry {}", actual_name),
        source: e,
    })?;

    let mut text = String::new();
    file.read_to_string(&mut text).map_err(|e| ParseError::Io {
        context: format!("reading entry {}", actual_name),
        source: e,
    })?;

    Ok(text)
}

/// Read a small named ZIP entry directly from disk without buffering the archive.
pub fn extract_zip_entry_from_path(
    path: &std::path::Path,
    entry_names: &[&str],
) -> Result<String, ParseError> {
    use std::io::Read;

    let file = std::fs::File::open(path).map_err(|source| ParseError::Io {
        context: format!("opening {}", path.display()),
        source,
    })?;
    let mut archive = zip::ZipArchive::new(file).map_err(|source| ParseError::Zip {
        context: format!("opening {}", path.display()),
        source,
    })?;
    let available: Vec<String> = archive.file_names().map(str::to_string).collect();
    let actual_name = entry_names
        .iter()
        .find_map(|candidate| {
            available
                .iter()
                .find(|available_name| available_name.eq_ignore_ascii_case(candidate))
        })
        .cloned()
        .ok_or_else(|| ParseError::EntryNotFound {
            entry: entry_names.join(" or "),
            available,
        })?;
    let mut entry = archive
        .by_name(&actual_name)
        .map_err(|source| ParseError::Zip {
            context: format!("reading entry {actual_name}"),
            source,
        })?;
    let mut text = String::with_capacity(entry.size().try_into().unwrap_or(0));
    entry
        .read_to_string(&mut text)
        .map_err(|source| ParseError::Io {
            context: format!("reading entry {actual_name}"),
            source,
        })?;
    Ok(text)
}

/// Parse an `indiv` file directly from ZIP bytes.
pub fn parse_individuals_from_zip(
    zip_bytes: &[u8],
    entry_name: &str,
) -> Result<(Vec<RawIndividualReceipt>, usize), ParseError> {
    let text = extract_zip_entry(zip_bytes, entry_name)?;
    Ok(parse_individuals(&text))
}

/// Parse an `oth` file directly from ZIP bytes.
pub fn parse_committee_txns_from_zip(
    zip_bytes: &[u8],
    entry_name: &str,
) -> Result<(Vec<RawCommitteeTxn>, usize), ParseError> {
    let text = extract_zip_entry(zip_bytes, entry_name)?;
    Ok(parse_committee_txns(&text))
}

// ── Helpers ───────────────────────────────────────────────────────────

fn opt_str(s: &str) -> Option<String> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

// ── Errors ────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("ZIP error: {context}: {source}")]
    Zip {
        context: String,
        #[source]
        source: zip::result::ZipError,
    },
    #[error("Entry '{entry}' not found in ZIP; available: {available:?}")]
    EntryNotFound {
        entry: String,
        available: Vec<String>,
    },
    #[error("I/O error {context}: {source}")]
    Io {
        context: String,
        #[source]
        source: std::io::Error,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fec_bulk::{build_donor_key, valid_cycle};
    use chrono::Datelike;

    #[test]
    fn test_parse_fec_date_valid() {
        assert_eq!(
            parse_fec_date("01152024"),
            Some(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap())
        );
    }

    #[test]
    fn test_parse_fec_date_zeros() {
        assert_eq!(parse_fec_date("00000000"), None);
    }

    #[test]
    fn test_parse_fec_date_rejects_impossible_source_years() {
        assert_eq!(parse_fec_date("01013312"), None);
        assert_eq!(parse_fec_date("01012026").unwrap().year(), 2026);
    }

    #[test]
    fn test_parse_fec_date_empty() {
        assert_eq!(parse_fec_date(""), None);
    }

    #[test]
    fn test_parse_amount_valid() {
        assert_eq!(parse_amount("1234.56"), Some(1234.56));
    }

    #[test]
    fn test_parse_amount_empty() {
        assert_eq!(parse_amount(""), None);
    }

    #[test]
    fn test_parse_amount_negative() {
        assert_eq!(parse_amount("-500.00"), Some(-500.0));
    }

    #[test]
    fn test_build_donor_key() {
        let key = build_donor_key("  Smith, John  ", "90210", "Acme Corp");
        assert_eq!(key, "SMITH, JOHN|90210|ACME CORP");
    }

    #[test]
    fn test_build_donor_key_long_zip() {
        let key = build_donor_key("Jane Doe", "90210-1234", "");
        assert_eq!(key, "JANE DOE|90210|");
    }

    #[test]
    fn test_parse_individuals_basic() {
        // Simulate a tiny indiv file
        let text = "CMTE_ID|AMNDT_IND|RPT_TP|TRANSACTION_PGI|IMAGE_NUM|TRANSACTION_TP|ENTITY_TP|NAME|CITY|STATE|ZIP_CODE|EMPLOYER|OCCUPATION|TRANSACTION_DT|TRANSACTION_AMT|OTHER_ID|TRAN_ID|FILE_NUM|MEMO_CD|MEMO_TEXT|SUB_ID\nC001|N||P|20240101|10|IND|Smith, John|Austin|TX|78701|Acme|Engineer|01152024|500.00||T001|12345|||1000001\n";
        let (rows, skipped) = parse_individuals(text);
        assert_eq!(skipped, 0);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].committee_id, "C001");
        assert_eq!(rows[0].contributor_name.as_deref(), Some("Smith, John"));
        assert_eq!(rows[0].transaction_amount, 500.0);
    }

    #[test]
    fn test_parse_individuals_rejects_invalid_amount_instead_of_inventing_zero() {
        let text = "CMTE_ID|AMNDT_IND|RPT_TP|TRANSACTION_PGI|IMAGE_NUM|TRANSACTION_TP|ENTITY_TP|NAME|CITY|STATE|ZIP_CODE|EMPLOYER|OCCUPATION|TRANSACTION_DT|TRANSACTION_AMT|OTHER_ID|TRAN_ID|FILE_NUM|MEMO_CD|MEMO_TEXT|SUB_ID\nC001|N||P|20240101|15|IND|Smith, John|Austin|TX|78701|Acme|Engineer|01152024|NOT_A_NUMBER||T001|12345|||1000001\n";

        let (rows, skipped) = parse_individuals(text);

        assert!(
            rows.is_empty(),
            "an invalid amount must not become a factual zero"
        );
        assert_eq!(skipped, 1);
    }

    #[test]
    fn test_parse_committee_master_official_15_column_shape() {
        let text = "CMTE_ID|CMTE_NM|TRES_NM|CMTE_ST1|CMTE_ST2|CMTE_CITY|CMTE_ST|CMTE_ZIP|CMTE_DSGN|CMTE_TP|CMTE_PTY_AFFILIATION|CMTE_FILING_FREQ|ORG_TP|CONNECTED_ORG_NM|CAND_ID\nC00100005|Example Committee|Hamilton, Alexander|1 First St||Alexandria|VA|22201|P|H|DEM|Q|C||H8VA01233\n";

        let (rows, skipped) = parse_committee_master(text);

        assert_eq!(skipped, 0);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].committee_id, "C00100005");
        assert_eq!(rows[0].candidate_id.as_deref(), Some("H8VA01233"));
    }

    #[test]
    fn test_parse_candidate_master_official_15_column_shape() {
        let text = "CAND_ID|CAND_NAME|CAND_PTY_AFFILIATION|CAND_ELECTION_YR|CAND_OFFICE_ST|CAND_OFFICE|CAND_OFFICE_DISTRICT|CAND_ICI|CAND_STATUS|CAND_PCC|CAND_ST1|CAND_ST2|CAND_CITY|CAND_ST|CAND_ZIP\nH8VA01233|WASHINGTON, MARTHA|DEM|2026|VA|H|01|I|C|C00100005|1 First St||Alexandria|VA|22201\n";

        let (rows, skipped) = parse_candidate_master(text);

        assert_eq!(skipped, 0);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].candidate_id, "H8VA01233");
        assert_eq!(rows[0].office.as_deref(), Some("H"));
        assert_eq!(rows[0].principal_committee_id.as_deref(), Some("C00100005"));
    }

    #[test]
    fn test_parse_ccl_basic() {
        let text = "CAND_ID|CAND_ELECTION_YR|FEC_ELECTION_YR|CMTE_ID|CMTE_TP|CMTE_DSGN|LINKAGE_ID\nH0CA12345|2024|2024|C00123|C|P|999\n";
        let (rows, skipped) = parse_ccl(text);
        assert_eq!(skipped, 0);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].candidate_id, "H0CA12345");
        assert_eq!(rows[0].committee_id, "C00123");
        assert_eq!(rows[0].election_cycle(), Some(2024));
    }

    #[test]
    fn test_ccl_prefers_fec_cycle_over_candidate_election_year() {
        let text = "CAND_ID|CAND_ELECTION_YR|FEC_ELECTION_YR|CMTE_ID|CMTE_TP|CMTE_DSGN|LINKAGE_ID\nH0CA12345|2028|2026|C00123|H|P|999\n";
        let (rows, skipped) = parse_ccl(text);

        assert_eq!(skipped, 0);
        assert_eq!(rows[0].election_cycle(), Some(2026));
    }

    #[test]
    fn test_valid_cycle() {
        assert!(valid_cycle(2024));
        assert!(valid_cycle(2026));
        assert!(!valid_cycle(2025));
        assert!(!valid_cycle(1979));
    }
}
