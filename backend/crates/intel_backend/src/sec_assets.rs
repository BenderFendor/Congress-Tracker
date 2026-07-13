//! SEC company-ticker crosswalk helpers for disclosure asset resolution.
//!
//! SEC mappings are periodically updated and are not complete. Callers must
//! retain unresolved aliases and never treat a fuzzy match as verified.

use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SecCompany {
    pub cik: String,
    pub name: String,
    pub ticker: String,
    pub exchange: Option<String>,
}

pub fn parse_company_tickers(payload: &Value) -> Vec<SecCompany> {
    let Some(rows) = payload.get("data").and_then(Value::as_array) else {
        return Vec::new();
    };
    rows.iter()
        .filter_map(|row| {
            let fields = row.as_array()?;
            let cik = fields.first()?.as_u64()?.to_string();
            let name = fields.get(1)?.as_str()?.trim();
            let ticker = fields.get(2)?.as_str()?.trim().to_ascii_uppercase();
            let exchange = fields
                .get(3)
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string);
            (!name.is_empty() && !ticker.is_empty()).then(|| SecCompany {
                cik: format!("{cik:0>10}"),
                name: name.to_string(),
                ticker,
                exchange,
            })
        })
        .collect()
}

pub fn normalize_company_name(value: &str) -> String {
    value
        .to_ascii_lowercase()
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || character.is_ascii_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_official_sec_array_shape_without_inventing_missing_fields() {
        let companies = parse_company_tickers(&json!({
            "data": [[320193, "Apple Inc.", "AAPL", "Nasdaq"], [1, "No ticker", "", ""]]
        }));
        assert_eq!(companies.len(), 1);
        assert_eq!(companies[0].cik, "0000320193");
        assert_eq!(companies[0].ticker, "AAPL");
        assert_eq!(companies[0].exchange.as_deref(), Some("Nasdaq"));
    }

    #[test]
    fn normalization_is_conservative_and_deterministic() {
        assert_eq!(
            normalize_company_name("Alphabet, Inc. Class A"),
            "alphabet inc class a"
        );
    }
}
