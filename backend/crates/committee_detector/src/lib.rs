//! Committee stock trade conflict detection.
//!
//! Based on the committee-to-sector mapping, overlap severity detection,
//! and the name -> BioguideID -> committees pipeline from
//! [poli-ticker](https://github.com/ibotzhub/poli-ticker) by ibotzhub.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Severity {
    Clean = 0,
    Adjacent = 1,
    Direct = 2,
}

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Severity::Clean => write!(f, "CLEAN"),
            Severity::Adjacent => write!(f, "ADJACENT"),
            Severity::Direct => write!(f, "DIRECT OVERLAP"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conflict {
    pub ticker: String,
    pub sector: String,
    pub industry: String,
    pub committee: String,
    pub severity: Severity,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitteeConflictResult {
    pub committees: Vec<String>,
    pub conflicts: Vec<Conflict>,
    pub highest_severity: Severity,
    pub flag_count: usize,
}

#[derive(Debug, Clone)]
pub struct TradeRef {
    pub ticker: String,
    pub sector: String,
    pub industry: String,
    pub trade_type: String,
}

// Source: poli-ticker config.py (https://github.com/ibotzhub/poli-ticker)
// Maps committee-name keywords to relevant stock sectors
pub static COMMITTEE_SECTOR_MAP: phf::Map<&'static str, &'static [&'static str]> = phf::phf_map! {
    // Defense / military
    "armed services" => &["Industrials", "Aerospace & Defense"],
    "defense" => &["Industrials", "Aerospace & Defense"],
    "veterans" => &["Healthcare", "Industrials"],
    "homeland security" => &["Industrials", "Technology"],

    // Finance / banking
    "banking" => &["Financial Services", "Finance"],
    "financial services" => &["Financial Services", "Finance"],
    "finance" => &["Financial Services", "Finance"],
    "appropriations" => &["Financial Services", "Industrials", "Technology"],

    // Healthcare / pharma
    "health" => &["Healthcare"],
    "pharmaceutical" => &["Healthcare"],
    "labor and health" => &["Healthcare"],

    // Energy
    "energy" => &["Energy", "Utilities"],
    "natural resources" => &["Energy", "Basic Materials"],
    "environment" => &["Energy", "Utilities", "Basic Materials"],

    // Technology
    "science" => &["Technology"],
    "technology" => &["Technology", "Communication Services"],
    "commerce" => &["Technology", "Communication Services", "Consumer Cyclical"],
    "intelligence" => &["Technology", "Industrials"],

    // Agriculture
    "agriculture" => &["Consumer Defensive", "Basic Materials"],

    // Transportation
    "transportation" => &["Industrials"],
    "infrastructure" => &["Industrials", "Utilities"],

    // Foreign affairs
    "foreign affairs" => &["Industrials", "Energy"],
    "foreign relations" => &["Industrials", "Energy"],
    "international trade" => &["Industrials", "Consumer Cyclical"],

    // Judiciary / oversight
    "judiciary" => &["Technology", "Communication Services"],
    "oversight" => &["Technology", "Financial Services", "Industrials"],

    // Budget / economy
    "budget" => &["Financial Services", "Industrials"],
    "ways and means" => &["Financial Services", "Healthcare", "Industrials"],
    "small business" => &["Financial Services", "Consumer Cyclical"],

    // Education / labor
    "education" => &["Consumer Defensive"],
    "labor" => &["Industrials", "Consumer Cyclical"],
};

/// Detect overlap between a member's committees and a stock trade's sector.
/// Returns the HIGHEST severity found across all committees.
/// Based on poli-ticker data.py detect_overlap() by ibotzhub.
pub fn detect_overlap(committees: &[String], sector: &str, industry: &str) -> Severity {
    if committees.is_empty() || sector.is_empty() {
        return Severity::Clean;
    }

    let sector_lower = sector.to_lowercase();
    let industry_lower = industry.to_lowercase();
    let mut best = Severity::Clean;

    for committee in committees {
        let cl = committee.to_lowercase();
        for (&keyword, mapped_sectors) in COMMITTEE_SECTOR_MAP.entries() {
            if !cl.contains(keyword) {
                continue;
            }
            for ms in *mapped_sectors {
                if sector_lower.contains(&ms.to_lowercase()) {
                    return Severity::Direct;
                }
                if industry_lower.contains(&ms.to_lowercase()) {
                    best = Severity::Adjacent;
                }
            }
        }
    }

    best
}

/// Check all trades against all committees and return detailed conflicts.
pub fn detect_all_conflicts(committees: &[String], trades: &[TradeRef]) -> CommitteeConflictResult {
    let mut conflicts = Vec::new();
    let mut highest = Severity::Clean;

    for trade in trades {
        for committee in committees {
            let severity = detect_overlap_one_committee(committee, &trade.sector, &trade.industry);
            if severity > Severity::Clean {
                conflicts.push(Conflict {
                    ticker: trade.ticker.clone(),
                    sector: trade.sector.clone(),
                    industry: trade.industry.clone(),
                    committee: committee.clone(),
                    severity,
                    description: format!(
                        "{} sits on the {} committee and traded {} ({}) in the {} sector",
                        "Member", committee, trade.ticker, trade.industry, trade.sector
                    ),
                });
            }
            highest = highest.max(severity);
        }
    }

    let flag_count = conflicts
        .iter()
        .filter(|c| c.severity > Severity::Clean)
        .count();

    CommitteeConflictResult {
        committees: committees.to_vec(),
        conflicts,
        highest_severity: highest,
        flag_count,
    }
}

fn detect_overlap_one_committee(committee: &str, sector: &str, industry: &str) -> Severity {
    if sector.is_empty() {
        return Severity::Clean;
    }
    let cl = committee.to_lowercase();
    let sector_lower = sector.to_lowercase();
    let industry_lower = industry.to_lowercase();

    for (&keyword, mapped_sectors) in COMMITTEE_SECTOR_MAP.entries() {
        if !cl.contains(keyword) {
            continue;
        }
        for ms in *mapped_sectors {
            if sector_lower.contains(&ms.to_lowercase()) {
                return Severity::Direct;
            }
            if industry_lower.contains(&ms.to_lowercase()) {
                return Severity::Adjacent;
            }
        }
    }
    Severity::Clean
}

/// Get all committee keywords (for UI)
pub fn all_committee_keywords() -> Vec<&'static str> {
    COMMITTEE_SECTOR_MAP.keys().copied().collect()
}

/// Get the sectors relevant to a committee keyword
pub fn sectors_for_committee(keyword: &str) -> Option<&'static [&'static str]> {
    COMMITTEE_SECTOR_MAP.get(&keyword.to_lowercase()).copied()
}

/// Format a user-facing description of a conflict
pub fn describe_conflict(conflict: &Conflict, member_name: &str) -> String {
    format!(
        "{} sits on the {} Committee and traded {} ({}) \u{2014} a {}-sector stock.",
        member_name, conflict.committee, conflict.ticker, conflict.industry, conflict.sector
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_direct_overlap_armed_services_buying_defense_stock() {
        let committees = vec!["Armed Services".to_string()];
        let severity = detect_overlap(&committees, "Industrials", "Aerospace & Defense");
        assert_eq!(severity, Severity::Direct);
    }

    #[test]
    fn test_direct_overlap_banking_buying_finance_stock() {
        let committees = vec!["Banking, Housing, and Urban Affairs".to_string()];
        let severity = detect_overlap(&committees, "Financial Services", "Banks-Diversified");
        assert_eq!(severity, Severity::Direct);
    }

    #[test]
    fn test_adjacent_overlap_health_committee_buying_medical_devices() {
        let committees = vec!["Health, Education, Labor, and Pensions".to_string()];
        let severity = detect_overlap(&committees, "Industrials", "Medical Devices");
        assert!(severity >= Severity::Adjacent);
    }

    #[test]
    fn test_clean_no_overlap_armed_services_buying_retail() {
        let committees = vec!["Armed Services".to_string()];
        let severity = detect_overlap(&committees, "Consumer Cyclical", "Specialty Retail");
        assert_eq!(severity, Severity::Clean);
    }

    #[test]
    fn test_highest_severity_wins() {
        let committees = vec!["Armed Services".to_string(), "Banking".to_string()];
        let severity = detect_overlap(&committees, "Industrials", "Aerospace & Defense");
        assert_eq!(severity, Severity::Direct);
    }

    #[test]
    fn test_empty_committees_is_clean() {
        let severity = detect_overlap(&[], "Healthcare", "Biotechnology");
        assert_eq!(severity, Severity::Clean);
    }

    #[test]
    fn test_empty_sector_is_clean() {
        let committees = vec!["Banking".to_string()];
        let severity = detect_overlap(&committees, "", "");
        assert_eq!(severity, Severity::Clean);
    }

    #[test]
    fn test_intelligence_committee_and_tech_stock() {
        let committees = vec!["Select Committee on Intelligence".to_string()];
        let severity = detect_overlap(&committees, "Technology", "Software-Infrastructure");
        assert_eq!(severity, Severity::Direct);
    }

    #[test]
    fn test_energy_committee_and_utility_stock() {
        let committees = vec!["Energy and Natural Resources".to_string()];
        let severity = detect_overlap(&committees, "Utilities", "Utilities-Regulated Electric");
        assert_eq!(severity, Severity::Direct);
    }

    #[test]
    fn test_detect_all_conflicts_multiple_trades() {
        let committees = vec!["Armed Services".to_string(), "Banking".to_string()];
        let trades = vec![
            TradeRef {
                ticker: "LMT".to_string(),
                sector: "Industrials".to_string(),
                industry: "Aerospace & Defense".to_string(),
                trade_type: "Purchase".to_string(),
            },
            TradeRef {
                ticker: "JPM".to_string(),
                sector: "Financial Services".to_string(),
                industry: "Banks-Diversified".to_string(),
                trade_type: "Purchase".to_string(),
            },
            TradeRef {
                ticker: "WMT".to_string(),
                sector: "Consumer Defensive".to_string(),
                industry: "Discount Stores".to_string(),
                trade_type: "Sale".to_string(),
            },
        ];
        let result = detect_all_conflicts(&committees, &trades);
        assert_eq!(result.highest_severity, Severity::Direct);
        assert!(result.flag_count >= 2);
        assert_eq!(result.committees.len(), 2);
    }

    #[test]
    fn test_detect_all_conflicts_no_matches() {
        let committees = vec!["Education".to_string()];
        let trades = vec![TradeRef {
            ticker: "XOM".to_string(),
            sector: "Energy".to_string(),
            industry: "Oil & Gas Integrated".to_string(),
            trade_type: "Purchase".to_string(),
        }];
        let result = detect_all_conflicts(&committees, &trades);
        assert_eq!(result.highest_severity, Severity::Clean);
        assert_eq!(result.flag_count, 0);
        assert!(result.conflicts.is_empty());
    }

    #[test]
    fn test_all_committee_keywords_has_entries() {
        let keywords = all_committee_keywords();
        assert!(keywords.contains(&"armed services"));
        assert!(keywords.contains(&"banking"));
        assert!(keywords.contains(&"energy"));
    }

    #[test]
    fn test_sectors_for_committee() {
        let sectors = sectors_for_committee("banking");
        assert!(sectors.is_some());
        let sectors = sectors.unwrap();
        assert!(sectors.contains(&"Financial Services"));
        assert!(sectors.contains(&"Finance"));
    }

    #[test]
    fn test_sectors_for_committee_nonexistent() {
        let sectors = sectors_for_committee("nonexistent_keyword");
        assert!(sectors.is_none());
    }

    #[test]
    fn test_describe_conflict() {
        let conflict = Conflict {
            ticker: "LMT".to_string(),
            sector: "Industrials".to_string(),
            industry: "Aerospace & Defense".to_string(),
            committee: "Armed Services".to_string(),
            severity: Severity::Direct,
            description: String::new(),
        };
        let desc = describe_conflict(&conflict, "Sen. Tuberville");
        assert!(desc.contains("Sen. Tuberville"));
        assert!(desc.contains("Armed Services"));
        assert!(desc.contains("LMT"));
        assert!(desc.contains("Aerospace & Defense"));
    }

    #[test]
    fn test_foreign_relations_committee_and_oil_stock() {
        let committees = vec!["Foreign Relations".to_string()];
        let severity = detect_overlap(&committees, "Energy", "Oil & Gas Integrated");
        assert_eq!(severity, Severity::Direct);
    }

    #[test]
    fn test_adjacent_health_committee_medical_devices_in_industry() {
        let committees = vec!["Health".to_string()];
        let severity = detect_overlap(&committees, "Industrials", "Healthcare Equipment");
        assert_eq!(severity, Severity::Adjacent);
    }

    #[test]
    fn test_case_insensitive_matching() {
        let committees = vec!["BANKING, HOUSING, AND URBAN AFFAIRS".to_string()];
        let severity = detect_overlap(&committees, "Financial Services", "Banks");
        assert_eq!(severity, Severity::Direct);
    }

    #[test]
    fn test_severity_display() {
        assert_eq!(Severity::Clean.to_string(), "CLEAN");
        assert_eq!(Severity::Adjacent.to_string(), "ADJACENT");
        assert_eq!(Severity::Direct.to_string(), "DIRECT OVERLAP");
    }

    #[test]
    fn test_severity_ordering() {
        assert!(Severity::Direct > Severity::Adjacent);
        assert!(Severity::Adjacent > Severity::Clean);
        assert!(Severity::Clean < Severity::Direct);
    }

    #[test]
    fn test_appropriations_committee_broad_reach() {
        let committees = vec!["Appropriations".to_string()];
        let severity = detect_overlap(&committees, "Technology", "Software-Infrastructure");
        assert_eq!(severity, Severity::Direct);
    }

    #[test]
    fn test_ways_and_means_healthcare_overlap() {
        let committees = vec!["Ways and Means".to_string()];
        let severity = detect_overlap(&committees, "Healthcare", "Biotechnology");
        assert_eq!(severity, Severity::Direct);
    }

    #[test]
    fn test_small_business_and_retail() {
        let committees = vec!["Small Business".to_string()];
        let severity = detect_overlap(&committees, "Consumer Cyclical", "Specialty Retail");
        assert_eq!(severity, Severity::Direct);
    }
}
