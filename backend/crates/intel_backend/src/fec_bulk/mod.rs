//! FEC bulk ZIP ingestion pipeline.
//!
//! Downloads FEC bulk data ZIPs from fec.gov/files/bulk-downloads/,
//! parses pipe-delimited records into staging tables, canonicalizes
//! (resolves amendments), and precomputes donor/committee rankings.
//!
//! Preferred over OpenFEC API pagination for large backfills because a
//! handful of ZIP files cover all ~5M receipts per cycle without
//! thousands of API page requests.

pub mod download;
pub mod parse;
pub mod canonicalize;
pub mod rankings;


/// FEC bulk data file types for a given election cycle.
pub struct CycleFiles {
    pub cycle: u32,
    pub suffix: String,
    pub files: Vec<BulkFile>,
}

/// One downloadable FEC bulk data file.
#[derive(Debug, Clone)]
pub struct BulkFile {
    /// Canonical dataset name, e.g. "indiv26", "oth26"
    pub dataset_name: String,
    /// Human-readable label, e.g. "Individual contributions"
    pub label: &'static str,
    /// Relative URL path under the FEC bulk download base.
    pub url_path: String,
}

impl CycleFiles {
    /// Build the set of files for a given election cycle (even year).
    ///
    /// `cycle` must be an even-numbered election year (e.g. 2022, 2024, 2026).
    pub fn new(cycle: u32) -> Self {
        let suffix = format!("{}", cycle % 100);
        let year_prefix = if cycle >= 2020 {
            cycle.to_string()
        } else {
            // Older cycles use a different URL convention, but we target 2020+
            cycle.to_string()
        };

        Self {
            cycle,
            suffix: suffix.clone(),
            files: vec![
                BulkFile {
                    dataset_name: format!("indiv{}", suffix),
                    label: "Individual contributions",
                    url_path: format!("{}/indiv{}.zip", year_prefix, suffix),
                },
                BulkFile {
                    dataset_name: format!("oth{}", suffix),
                    label: "Committee transactions",
                    url_path: format!("{}/oth{}.zip", year_prefix, suffix),
                },
                BulkFile {
                    dataset_name: format!("cm{}", suffix),
                    label: "Committee master",
                    url_path: format!("{}/cm{}.zip", year_prefix, suffix),
                },
                BulkFile {
                    dataset_name: format!("ccl{}", suffix),
                    label: "Candidate-committee links",
                    url_path: format!("{}/ccl{}.zip", year_prefix, suffix),
                },
                BulkFile {
                    dataset_name: format!("cn{}", suffix),
                    label: "Candidate master",
                    url_path: format!("{}/cn{}.zip", year_prefix, suffix),
                },
            ],
        }
    }

    /// FEC bulk download base URL.
    pub fn base_url() -> &'static str {
        "https://www.fec.gov/files/bulk-downloads"
    }
}

/// FEC pipe-delimited column indices for the `indiv` file.
pub mod indiv_columns {
    pub const CMTE_ID: usize = 0;
    pub const AMNDT_IND: usize = 1;
    pub const RPT_TP: usize = 2;
    pub const TRANSACTION_PGI: usize = 3;
    pub const IMAGE_NUM: usize = 4;
    pub const TRANSACTION_TP: usize = 5;
    pub const ENTITY_TP: usize = 6;
    pub const NAME: usize = 7;
    pub const CITY: usize = 8;
    pub const STATE: usize = 9;
    pub const ZIP_CODE: usize = 10;
    pub const EMPLOYER: usize = 11;
    pub const OCCUPATION: usize = 12;
    pub const TRANSACTION_DT: usize = 13;
    pub const TRANSACTION_AMT: usize = 14;
    pub const OTHER_ID: usize = 15;
    pub const TRAN_ID: usize = 16;
    pub const FILE_NUM: usize = 17;
    pub const MEMO_CD: usize = 18;
    pub const MEMO_TEXT: usize = 19;
    pub const SUB_ID: usize = 20;
}

/// FEC pipe-delimited column indices for the `oth` file (same layout).
pub use indiv_columns as oth_columns;

/// FEC pipe-delimited column indices for the `cm` file.
pub mod cm_columns {
    pub const CMTE_ID: usize = 0;
    pub const CMTE_NM: usize = 1;
    pub const TRES_NM: usize = 2;
    pub const CMTE_ST1: usize = 3;
    pub const CMTE_ST2: usize = 4;
    pub const CMTE_CITY: usize = 5;
    pub const CMTE_ST: usize = 6;
    pub const CMTE_ZIP: usize = 7;
    pub const CMTE_DSGN: usize = 8;
    pub const CMTE_TP: usize = 9;
    pub const CMTE_PTY_AFFILIATION: usize = 10;
    pub const CMTE_FILING_FREQ: usize = 11;
    pub const ORG_TP: usize = 12;
    pub const CONNECTED_ORG_NM: usize = 13;
    pub const CAND_ID: usize = 14;
}

/// FEC pipe-delimited column indices for the `ccl` file.
pub mod ccl_columns {
    pub const CAND_ID: usize = 0;
    pub const CAND_ELECTION_YR: usize = 1;
    pub const FEC_ELECTION_YR: usize = 2;
    pub const CMTE_ID: usize = 3;
    pub const CMTE_TP: usize = 4;
    pub const CMTE_DSGN: usize = 5;
    pub const LINKAGE_ID: usize = 6;
}

/// Default storage directory for downloaded ZIPs.
pub fn storage_dir() -> std::path::PathBuf {
    std::env::var("WORKER_STORAGE_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("./worker_storage/fec"))
}

/// Build a donor key from contributor fields for conservative grouping.
///
/// Format: `NORMALIZED_NAME|ZIP5|NORMALIZED_EMPLOYER`
/// This avoids merging unrelated people with the same name while still
/// collapsing minor spelling variations.
pub fn build_donor_key(name: &str, zip: &str, employer: &str) -> String {
    let name = name.trim().to_uppercase();
    let zip = zip.trim();
    // Keep only the first 5 digits of ZIP
    let zip5: String = zip.chars().take_while(|c| c.is_ascii_digit()).take(5).collect();
    let employer = employer.trim().to_uppercase();
    format!("{}|{}|{}", name, zip5, employer)
}

/// Parse an FEC date string in MMDDYYYY format to an optional NaiveDate.
pub fn parse_fec_date(s: &str) -> Option<chrono::NaiveDate> {
    let s = s.trim();
    if s.len() != 8 || s.chars().all(|c| c == '0') {
        return None;
    }
    chrono::NaiveDate::parse_from_str(s, "%m%d%Y").ok()
}

/// Parse a numeric field, returning 0.0 on empty/unparseable.
pub fn parse_amount(s: &str) -> f64 {
    s.trim().parse::<f64>().unwrap_or(0.0)
}

/// Parse an integer field.
pub fn parse_int(s: &str) -> Option<i64> {
    s.trim().parse::<i64>().ok()
}

/// Check whether a 2-year election cycle is valid (even year, >= 1980).
pub fn valid_cycle(cycle: u32) -> bool {
    cycle >= 1980 && cycle % 2 == 0
}
