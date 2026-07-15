pub mod job_policy;
pub mod parsers;

#[cfg(test)]
mod sample_corpus_tests {
    use crate::parsers::{fingerprint, parse_annual_electronic, parse_ptr_text, DocumentLayout};

    const HOUSE_PTR_2024: &str = include_str!("../tests/fixtures/house_ptr_2024.txt");
    const HOUSE_ANNUAL_2024: &str = include_str!("../tests/fixtures/house_annual_2024.txt");
    const UNKNOWN_LAYOUT: &str = include_str!("../tests/fixtures/unknown_disclosure_layout.txt");

    #[test]
    fn bounded_house_ptr_sample_preserves_rows_ranges_and_tickers() {
        assert_eq!(
            fingerprint(HOUSE_PTR_2024),
            DocumentLayout::PtrElectronic2022Plus
        );

        let rows = parse_ptr_text(HOUSE_PTR_2024);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].owner_type, "spouse");
        assert_eq!(rows[0].ticker.as_deref(), Some("ACN"));
        assert_eq!(rows[0].transaction_type, "purchase");
        assert_eq!(rows[0].amount_min, Some(1001.0));
        assert_eq!(rows[0].amount_max, Some(15000.0));
        assert_eq!(rows[1].owner_type, "joint");
        assert_eq!(rows[1].ticker.as_deref(), Some("AAPL"));
        assert_eq!(rows[1].transaction_type, "sale");
        assert_eq!(rows[1].amount_min, Some(15001.0));
        assert_eq!(rows[1].amount_max, Some(50000.0));
    }

    #[test]
    fn bounded_house_annual_sample_preserves_metadata_assets_and_ranges() {
        assert_eq!(
            fingerprint(HOUSE_ANNUAL_2024),
            DocumentLayout::AnnualElectronic
        );

        let report = parse_annual_electronic(HOUSE_ANNUAL_2024);
        assert_eq!(report.filing_type.as_deref(), Some("Annual"));
        assert_eq!(report.filing_year, Some(2024));
        assert_eq!(report.assets.len(), 2);
        assert_eq!(report.assets[0].owner_type, "spouse");
        assert_eq!(report.assets[0].ticker.as_deref(), Some("AAPL"));
        assert_eq!(report.assets[0].value.minimum, 15001.0);
        assert_eq!(report.assets[0].value.maximum, Some(50000.0));
        assert_eq!(report.assets[1].owner_type, "joint");
        assert_eq!(report.assets[1].value.minimum, 50001.0);
        assert_eq!(report.assets[1].value.maximum, Some(100000.0));
    }

    #[test]
    fn malformed_sample_stays_unknown_and_produces_no_canonical_rows() {
        assert_eq!(fingerprint(UNKNOWN_LAYOUT), DocumentLayout::Unknown);
        assert!(parse_ptr_text(UNKNOWN_LAYOUT).is_empty());

        let report = parse_annual_electronic(UNKNOWN_LAYOUT);
        assert!(report.assets.is_empty());
        assert!(report.liabilities.is_empty());
        assert!(report.income.is_empty());
        assert!(report.gifts.is_empty());
        assert!(report.positions.is_empty());
    }
}
