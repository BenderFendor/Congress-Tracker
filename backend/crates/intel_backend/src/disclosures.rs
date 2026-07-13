use chrono::NaiveDate;

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedPtrTransaction {
    pub owner_type: String,
    pub asset_name: String,
    pub ticker: Option<String>,
    pub transaction_type: String,
    pub amount_min: Option<f64>,
    pub amount_max: Option<f64>,
    pub transaction_date: Option<NaiveDate>,
    pub disclosure_date: Option<NaiveDate>,
    pub raw_text: String,
}

/// Parse transaction rows emitted by `pdftotext -layout` for a House PTR.
pub fn parse_house_ptr_text(text: &str) -> Vec<ParsedPtrTransaction> {
    let lines: Vec<&str> = text.lines().collect();
    let mut transactions = Vec::new();
    for (index, line) in lines.iter().enumerate() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 6 {
            continue;
        }
        let Some(date_index) = fields.iter().position(|field| is_us_date(field)) else {
            continue;
        };
        let Some(disclosure_date) = fields
            .get(date_index + 1)
            .and_then(|field| parse_us_date(field))
        else {
            continue;
        };
        if date_index < 2 {
            continue;
        }
        let Some(transaction_type_index) = (1..=3)
            .filter_map(|distance| date_index.checked_sub(distance))
            .find(|candidate| !normalize_transaction_type(fields[*candidate]).is_empty())
        else {
            continue;
        };
        let transaction_type = normalize_transaction_type(fields[transaction_type_index]);
        if transaction_type.is_empty() {
            continue;
        }
        let owner = owner_type(fields[0]);
        let asset_start = usize::from(owner != "unknown");
        let asset_name = fields[asset_start..transaction_type_index].join(" ");
        if asset_name.is_empty() {
            continue;
        }
        let (amount_min, amount_max) = parse_amount_range(&fields[date_index + 2..].join(" "));
        let ticker = (0..=2)
            .filter_map(|offset| lines.get(index + offset))
            .find_map(|candidate| extract_ticker(candidate));
        transactions.push(ParsedPtrTransaction {
            owner_type: owner,
            asset_name: remove_ticker_suffix(&asset_name),
            ticker,
            transaction_type,
            amount_min,
            amount_max,
            transaction_date: parse_us_date(fields[date_index]),
            disclosure_date: Some(disclosure_date),
            raw_text: line.to_string(),
        });
    }
    transactions
}

fn is_us_date(value: &str) -> bool {
    value.len() == 10
        && value.as_bytes().get(2) == Some(&b'/')
        && value.as_bytes().get(5) == Some(&b'/')
}

fn parse_us_date(value: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(value, "%m/%d/%Y").ok()
}

fn owner_type(value: &str) -> String {
    match value {
        "SP" => "spouse",
        "JT" => "joint",
        "DC" | "CH" => "dependent",
        "SE" | "SELF" => "self",
        _ => "unknown",
    }
    .to_string()
}

fn normalize_transaction_type(value: &str) -> String {
    if value.starts_with('P') {
        "purchase".to_string()
    } else if value.starts_with('S') {
        "sale".to_string()
    } else if value.starts_with('E') {
        "exchange".to_string()
    } else {
        String::new()
    }
}

fn extract_ticker(value: &str) -> Option<String> {
    let start = value.rfind('(')?;
    let end = value[start + 1..].find(')')? + start + 1;
    let ticker = value[start + 1..end].trim();
    if ticker.is_empty()
        || !ticker.chars().all(|character| {
            character.is_ascii_uppercase()
                || character.is_ascii_digit()
                || character == '.'
                || character == '-'
        })
    {
        return None;
    }
    Some(ticker.to_string())
}

fn remove_ticker_suffix(value: &str) -> String {
    let without_type = value.split(" [").next().unwrap_or(value).trim();
    if without_type.ends_with(')') {
        if let Some(start) = without_type.rfind('(') {
            return without_type[..start].trim().to_string();
        }
    }
    without_type.to_string()
}

fn parse_amount_range(value: &str) -> (Option<f64>, Option<f64>) {
    let amounts: Vec<f64> = value
        .split_whitespace()
        .filter_map(|field| {
            let cleaned = field
                .trim_matches(|character: char| !character.is_ascii_digit() && character != '.')
                .replace(',', "");
            if cleaned.is_empty() {
                None
            } else {
                cleaned.parse::<f64>().ok()
            }
        })
        .collect();
    match amounts.as_slice() {
        [first, ..] => (Some(*first), amounts.get(1).copied().or(Some(*first))),
        _ => (None, None),
    }
}

#[cfg(test)]
mod tests {
    use super::parse_house_ptr_text;

    #[test]
    fn parses_wrapped_house_ptr_rows() {
        let text = "SP Accenture plc Class A Ordinary P 08/07/2024 05/19/2025 $1,001 - $15,000\n    Shares (ACN) [ST]\nJT Apple Inc. - Common Stock (AAPL) S (partial) 01/30/2024 05/19/2025 $1,001 - $15,000";
        let rows = parse_house_ptr_text(text);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].owner_type, "spouse");
        assert_eq!(rows[0].ticker.as_deref(), Some("ACN"));
        assert_eq!(rows[0].transaction_type, "purchase");
        assert_eq!(rows[0].amount_min, Some(1001.0));
        assert_eq!(rows[0].amount_max, Some(15000.0));
        assert_eq!(rows[1].owner_type, "joint");
        assert_eq!(rows[1].transaction_type, "sale");
        assert_eq!(rows[1].asset_name, "Apple Inc. - Common Stock");
    }

    #[test]
    fn ignores_unanchored_lines() {
        assert!(parse_house_ptr_text("Asset without dates (ABC) [ST]").is_empty());
    }

    #[test]
    fn parses_current_house_rows_without_an_owner_code() {
        let text = "Parkland, PA School District Municipal Bond [GS] P 02/20/2026 03/09/2026 $50,001 - $100,000";
        let rows = parse_house_ptr_text(text);

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].owner_type, "unknown");
        assert_eq!(
            rows[0].asset_name,
            "Parkland, PA School District Municipal Bond"
        );
        assert_eq!(rows[0].transaction_type, "purchase");
        assert_eq!(rows[0].amount_min, Some(50001.0));
        assert_eq!(rows[0].amount_max, Some(100000.0));
    }
}
