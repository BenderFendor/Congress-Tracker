use chrono::NaiveDate;

#[derive(Debug, Clone, PartialEq)]
pub struct DisclosureRange {
    pub minimum: f64,
    pub maximum: Option<f64>,
    pub is_unbounded: bool,
    pub raw: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedAnnualAsset {
    pub owner_type: String,
    pub asset_name: String,
    pub asset_type_code: Option<String>,
    pub ticker: Option<String>,
    pub value: DisclosureRange,
    pub raw_text: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedAnnualLiability {
    pub owner_type: String,
    pub creditor_name: String,
    pub date_incurred: Option<String>,
    pub liability_type: String,
    pub amount: DisclosureRange,
    pub raw_text: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedAnnualIncome {
    pub owner_type: String,
    pub source_description: String,
    pub income_type: String,
    pub amount: Option<DisclosureRange>,
    pub raw_text: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedAnnualGift {
    pub owner_type: String,
    pub source_description: String,
    pub gift_type: String,
    pub value: Option<DisclosureRange>,
    pub raw_text: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedAnnualPosition {
    pub owner_type: String,
    pub organization_name: String,
    pub position_title: String,
    pub raw_text: String,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct ParsedAnnualReport {
    pub filing_type: Option<String>,
    pub filing_year: Option<i32>,
    pub filing_date: Option<NaiveDate>,
    pub reporting_period_start: Option<NaiveDate>,
    pub reporting_period_end: Option<NaiveDate>,
    pub assets: Vec<ParsedAnnualAsset>,
    pub liabilities: Vec<ParsedAnnualLiability>,
    pub income: Vec<ParsedAnnualIncome>,
    pub gifts: Vec<ParsedAnnualGift>,
    pub positions: Vec<ParsedAnnualPosition>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReportedNetWorth {
    pub asset_minimum: f64,
    pub asset_maximum: Option<f64>,
    pub liability_minimum: f64,
    pub liability_maximum: Option<f64>,
    pub net_worth_minimum: Option<f64>,
    pub net_worth_maximum: Option<f64>,
    pub upper_bound_unavailable: bool,
}

pub fn parse_disclosure_range(value: &str) -> Option<DisclosureRange> {
    let normalized = value
        .replace(['–', '—'], "-")
        .replace("greater than", "over")
        .replace("Greater than", "over");
    let lower = normalized.to_ascii_lowercase();
    let numbers: Vec<f64> = normalized
        .split_whitespace()
        .filter_map(|part| {
            let cleaned = part
                .trim_matches(|character: char| {
                    !character.is_ascii_digit() && character != '.' && character != ','
                })
                .replace(',', "");
            (!cleaned.is_empty())
                .then(|| cleaned.parse::<f64>().ok())
                .flatten()
        })
        .collect();
    let minimum = *numbers.first()?;
    let is_unbounded =
        lower.contains("over $") || lower.contains("over$") || lower.contains("more than");
    let first_digit = normalized.find(|character: char| character.is_ascii_digit())?;
    let first_end = normalized[first_digit..]
        .char_indices()
        .take_while(|(_, character)| {
            character.is_ascii_digit() || *character == ',' || *character == '.'
        })
        .last()
        .map_or(first_digit, |(offset, character)| {
            offset + character.len_utf8() + first_digit
        });
    let remainder = normalized[first_end..].trim_start();
    let maximum = if is_unbounded {
        None
    } else if remainder.starts_with('-') {
        let after_dash = remainder.strip_prefix('-').unwrap_or_default().trim_start();
        let next_number = numbers.get(1).copied();
        let before_next_number = after_dash
            .find(|character: char| character.is_ascii_digit())
            .map_or(after_dash, |offset| &after_dash[..offset]);
        if before_next_number
            .chars()
            .any(|character| character.is_ascii_alphabetic())
        {
            None
        } else {
            next_number
        }
    } else {
        Some(minimum)
    };
    let maximum = maximum.filter(|value| *value >= minimum);
    Some(DisclosureRange {
        minimum,
        maximum,
        is_unbounded,
        raw: value.trim().to_string(),
    })
}

pub fn parse_house_annual_text(text: &str) -> ParsedAnnualReport {
    let mut report = ParsedAnnualReport {
        filing_type: field_value(text, "Filing Type:"),
        filing_year: field_value(text, "Filing Year:").and_then(|value| value.parse().ok()),
        filing_date: field_value(text, "Filing Date:")
            .and_then(|value| NaiveDate::parse_from_str(&value, "%m/%d/%Y").ok()),
        ..ParsedAnnualReport::default()
    };
    if let Some(period) = field_value(text, "Period Covered:") {
        let dates: Vec<NaiveDate> = period
            .replace(['–', '—'], "-")
            .split('-')
            .filter_map(|value| NaiveDate::parse_from_str(value.trim(), "%m/%d/%Y").ok())
            .collect();
        report.reporting_period_start = dates.first().copied();
        report.reporting_period_end = dates.get(1).copied();
    }
    report.assets = parse_assets(section(text, 'A'));
    report.income = parse_income(section(text, 'C'));
    report.liabilities = parse_liabilities(section(text, 'D'));
    report.positions = parse_positions(section(text, 'E'));
    report.gifts = parse_gifts(section(text, 'G'));
    report
}

pub fn calculate_reported_net_worth(
    assets: &[ParsedAnnualAsset],
    liabilities: &[ParsedAnnualLiability],
) -> Option<ReportedNetWorth> {
    if assets.is_empty() && liabilities.is_empty() {
        return None;
    }
    let asset_minimum = assets.iter().map(|asset| asset.value.minimum).sum();
    let asset_maximum = sum_bounded(assets.iter().map(|asset| &asset.value));
    let liability_minimum = liabilities
        .iter()
        .map(|liability| liability.amount.minimum)
        .sum();
    let liability_maximum = sum_bounded(liabilities.iter().map(|liability| &liability.amount));
    Some(ReportedNetWorth {
        asset_minimum,
        asset_maximum,
        liability_minimum,
        liability_maximum,
        net_worth_minimum: liability_maximum.map(|maximum| asset_minimum - maximum),
        net_worth_maximum: asset_maximum.map(|maximum| maximum - liability_minimum),
        upper_bound_unavailable: asset_maximum.is_none(),
    })
}

fn sum_bounded<'a>(values: impl Iterator<Item = &'a DisclosureRange>) -> Option<f64> {
    let mut total = 0.0;
    for value in values {
        total += value.maximum?;
    }
    Some(total)
}

fn field_value(text: &str, label: &str) -> Option<String> {
    text.lines().find_map(|line| {
        let (_, value) = line.split_once(label)?;
        let value = value.trim();
        (!value.is_empty()).then(|| value.to_string())
    })
}

fn section(text: &str, wanted: char) -> Vec<&str> {
    let mut active = false;
    let mut lines = Vec::new();
    for line in text.lines() {
        if let Some(marker) = section_marker(line) {
            if active && marker != wanted {
                break;
            }
            active = marker == wanted;
            continue;
        }
        if active {
            lines.push(line);
        }
    }
    lines
}

fn section_marker(line: &str) -> Option<char> {
    let fields: Vec<&str> = line.split_whitespace().collect();
    if fields.first().copied() != Some("S") {
        return None;
    }
    let marker = fields.get(1)?.strip_suffix(':')?;
    (marker.len() == 1).then(|| marker.chars().next()).flatten()
}

fn parse_assets(lines: Vec<&str>) -> Vec<ParsedAnnualAsset> {
    let mut assets = Vec::new();
    let mut pending_name = Vec::new();
    let mut index = 0;
    while index < lines.len() {
        let line = lines[index];
        let trimmed = line.trim();
        if trimmed.is_empty()
            || trimmed.starts_with("Asset ")
            || trimmed.starts_with('*')
            || trimmed == "None disclosed."
            || trimmed.starts_with('D') && trimmed.contains(':')
        {
            index += 1;
            continue;
        }
        if let Some(value_start) = range_start(line) {
            let mut raw = line.to_string();
            let mut range_text = value_range_text(&line[value_start..]);
            let mut value = parse_disclosure_range(&range_text);
            if value.as_ref().is_some_and(|range| {
                range.maximum.is_none() && !range.is_unbounded && range_text.contains('-')
            }) {
                if let Some(next) = lines.get(index + 1).map(|next| next.trim()) {
                    if next.starts_with('$') {
                        range_text.push(' ');
                        range_text.push_str(next);
                        raw.push('\n');
                        raw.push_str(lines[index + 1]);
                        value = parse_disclosure_range(&range_text);
                        index += 1;
                    }
                }
            }
            if let Some(value) = value {
                let prefix = line[..value_start].trim();
                if !prefix.is_empty() {
                    pending_name.push(prefix);
                }
                let joined = pending_name.join(" ");
                let (owner_type, with_owner_removed) = extract_owner(&joined);
                let asset_type_code = bracket_code(&with_owner_removed);
                let ticker = ticker(&with_owner_removed, asset_type_code.as_deref());
                let asset_name = clean_asset_name(&with_owner_removed);
                if !asset_name.is_empty() {
                    assets.push(ParsedAnnualAsset {
                        owner_type,
                        asset_name,
                        asset_type_code,
                        ticker,
                        value,
                        raw_text: raw,
                    });
                }
                pending_name.clear();
            }
        } else if !trimmed.starts_with("Income") && !trimmed.starts_with("Current Year") {
            pending_name.push(trimmed);
        }
        index += 1;
    }
    assets
}

fn parse_liabilities(lines: Vec<&str>) -> Vec<ParsedAnnualLiability> {
    let Some(header_index) = lines.iter().position(|line| {
        line.contains("Creditor") && line.contains("Date Incurred") && line.contains("Type")
    }) else {
        return Vec::new();
    };
    let header = lines[header_index];
    let creditor_column = header.find("Creditor").unwrap_or(6);
    let date_column = header.find("Date Incurred").unwrap_or(48);
    let type_column = header.find("Type").unwrap_or(70);
    let amount_column = header.find("Amount of").unwrap_or(112);
    let mut liabilities = Vec::new();
    let mut index = header_index + 1;
    while index < lines.len() {
        let line = lines[index];
        if line.trim() == "None disclosed." {
            break;
        }
        if let Some(value_start) = range_start(line) {
            let mut range_text = line[value_start..].to_string();
            let mut raw = line.to_string();
            let mut amount = parse_disclosure_range(&range_text);
            if amount.as_ref().is_some_and(|range| {
                range.maximum.is_none() && !range.is_unbounded && range_text.contains('-')
            }) {
                if let Some(next) = lines.get(index + 1).map(|next| next.trim()) {
                    if next.starts_with('$') {
                        range_text.push(' ');
                        range_text.push_str(next);
                        raw.push('\n');
                        raw.push_str(lines[index + 1]);
                        amount = parse_disclosure_range(&range_text);
                        index += 1;
                    }
                }
            }
            if let Some(amount) = amount {
                let owner = column(line, 0, creditor_column);
                let creditor = column(line, creditor_column, date_column)
                    .trim()
                    .to_string();
                let date_incurred = column(line, date_column, type_column).trim().to_string();
                let liability_type = column(line, type_column, amount_column).trim().to_string();
                if !creditor.is_empty() {
                    liabilities.push(ParsedAnnualLiability {
                        owner_type: owner_code(owner.trim()),
                        creditor_name: creditor,
                        date_incurred: (!date_incurred.is_empty()).then_some(date_incurred),
                        liability_type,
                        amount,
                        raw_text: raw,
                    });
                }
            }
        }
        index += 1;
    }
    liabilities
}

fn parse_income(lines: Vec<&str>) -> Vec<ParsedAnnualIncome> {
    let Some(header_index) = lines.iter().position(|line| {
        line.contains("Source") && line.contains("Type") && line.contains("Amount")
    }) else {
        return Vec::new();
    };
    lines[header_index + 1..]
        .iter()
        .filter_map(|line| {
            let fields = gap_columns(line);
            let source = fields.first()?.to_string();
            if source.is_empty()
                || source == "None disclosed."
                || source.starts_with("Current Year")
                || source == "Filing"
            {
                return None;
            }
            let income_type = fields.get(1)?.to_string();
            let amount = fields[2..]
                .iter()
                .find_map(|field| parse_disclosure_range(field));
            Some(ParsedAnnualIncome {
                owner_type: if income_type.to_ascii_lowercase().contains("spouse") {
                    "spouse".to_string()
                } else {
                    "self".to_string()
                },
                source_description: source,
                income_type,
                amount,
                raw_text: (*line).to_string(),
            })
        })
        .collect()
}

fn parse_positions(lines: Vec<&str>) -> Vec<ParsedAnnualPosition> {
    let Some(header_index) = lines
        .iter()
        .position(|line| line.contains("Position") && line.contains("Name of Organization"))
    else {
        return Vec::new();
    };
    lines[header_index + 1..]
        .iter()
        .filter_map(|line| {
            let fields = gap_columns(line);
            let position = fields.first()?.to_string();
            let organization = fields.get(1)?.to_string();
            if position.is_empty() || organization.is_empty() || position == "None disclosed." {
                return None;
            }
            Some(ParsedAnnualPosition {
                owner_type: "self".to_string(),
                organization_name: organization,
                position_title: position,
                raw_text: (*line).to_string(),
            })
        })
        .collect()
}

fn parse_gifts(lines: Vec<&str>) -> Vec<ParsedAnnualGift> {
    let Some(header_index) = lines.iter().position(|line| {
        line.contains("Source") && line.contains("Description") && line.contains("Value")
    }) else {
        return Vec::new();
    };
    lines[header_index + 1..]
        .iter()
        .filter_map(|line| {
            let fields = gap_columns(line);
            let source = fields.first()?.to_string();
            let description = fields.get(1)?.to_string();
            if source.is_empty() || description.is_empty() || source == "None disclosed." {
                return None;
            }
            Some(ParsedAnnualGift {
                owner_type: "self".to_string(),
                source_description: source,
                gift_type: description,
                value: fields
                    .get(2)
                    .and_then(|value| parse_disclosure_range(value)),
                raw_text: (*line).to_string(),
            })
        })
        .collect()
}

fn gap_columns(line: &str) -> Vec<&str> {
    line.split("  ")
        .map(str::trim)
        .filter(|field| !field.is_empty())
        .collect()
}

fn range_start(line: &str) -> Option<usize> {
    let dollar = line.find('$')?;
    let prefix = &line[..dollar];
    let lower = prefix.to_ascii_lowercase();
    for marker in ["greater than", "more than", "over"] {
        if let Some(start) = lower.rfind(marker) {
            return Some(start);
        }
    }
    Some(dollar)
}

/// House PDF text can place the income column on the same line as the first
/// value bound (for example `$250,001 - Rent $2,501 - $5,000`). Keep the
/// value column separate so an income range can never become an asset bound.
fn value_range_text(value_column: &str) -> String {
    let Some(dash) = value_column.find('-') else {
        return value_column.to_string();
    };
    let after_dash = &value_column[dash + 1..];
    let next_dollar = after_dash.find('$');
    if after_dash[..next_dollar.unwrap_or(after_dash.len())]
        .chars()
        .any(|character| character.is_ascii_alphabetic())
    {
        return value_column[..=dash].to_string();
    }
    value_column.to_string()
}

fn extract_owner(value: &str) -> (String, String) {
    let mut fields: Vec<&str> = value.split_whitespace().collect();
    let owner = fields
        .last()
        .filter(|field| matches!(**field, "SP" | "JT" | "DC" | "CH" | "SE"))
        .copied();
    if owner.is_some() {
        fields.pop();
    }
    (owner_code(owner.unwrap_or("SE")), fields.join(" "))
}

fn owner_code(value: &str) -> String {
    match value.trim() {
        "SP" => "spouse",
        "JT" => "joint",
        "DC" | "CH" => "dependent",
        _ => "self",
    }
    .to_string()
}

fn bracket_code(value: &str) -> Option<String> {
    let start = value.rfind('[')?;
    let end = value[start..].find(']')? + start;
    let code = value[start + 1..end].trim();
    (!code.is_empty()).then(|| code.to_string())
}

fn ticker(value: &str, asset_type_code: Option<&str>) -> Option<String> {
    if !matches!(asset_type_code, Some("ST" | "OP" | "RS")) {
        return None;
    }
    let start = value.rfind('(')?;
    let end = value[start..].find(')')? + start;
    let candidate = value[start + 1..end].trim();
    (!candidate.is_empty()
        && candidate.len() <= 8
        && candidate
            .chars()
            .all(|character| character.is_ascii_uppercase() || ".-".contains(character)))
    .then(|| candidate.to_string())
}

fn clean_asset_name(value: &str) -> String {
    let without_code = value
        .rsplit_once('[')
        .map_or(value, |(name, _)| name)
        .trim();
    if without_code.ends_with(')') {
        if let Some(start) = without_code.rfind('(') {
            let candidate = &without_code[start + 1..without_code.len() - 1];
            if candidate.len() <= 8
                && candidate
                    .chars()
                    .all(|character| character.is_ascii_uppercase() || ".-".contains(character))
            {
                return without_code[..start].trim().to_string();
            }
        }
    }
    without_code.to_string()
}

fn column(value: &str, start: usize, end: usize) -> String {
    value
        .chars()
        .skip(start)
        .take(end.saturating_sub(start))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disclosure_ranges_preserve_unbounded_categories() {
        assert_eq!(
            parse_disclosure_range("$15,001 - $50,000"),
            Some(DisclosureRange {
                minimum: 15_001.0,
                maximum: Some(50_000.0),
                is_unbounded: false,
                raw: "$15,001 - $50,000".to_string(),
            })
        );
        assert_eq!(
            parse_disclosure_range("Greater than $50,000,000")
                .expect("unbounded range")
                .maximum,
            None
        );
        assert!(
            parse_disclosure_range("Greater than $50,000,000")
                .expect("unbounded range")
                .is_unbounded
        );
        assert_eq!(
            parse_disclosure_range("$250,000 Dividends $2,500")
                .expect("single value with adjacent income")
                .maximum,
            Some(250_000.0)
        );
    }

    #[test]
    fn parses_assets_and_liability_from_house_layout() {
        let text = r#"Filing Type:                Annual Report
Filing Year:                2025
Filing Date:                05/12/2026
Period Covered:             01/01/2025– 12/31/2025
S                  A: A                       "U                   "I
Asset                                                                   Owner Value of Asset
TIAA-CREF Annuity Account [PE]                                                    $250,001 -
                                                                                  $500,000
Apple Inc. Common Stock (AAPL) [ST]                                      SP       $15,001 - $50,000
S                 D: L
Owner Creditor                                      Date Incurred       Type                                          Amount of
                                                                                                                      Liability
          U.S. Department of Education              2008-2016           Federal Direct Student Loans                  $250,001 -
                                                                                                                      $500,000
S                 E: P
None disclosed."#;
        let report = parse_house_annual_text(text);
        assert_eq!(report.filing_year, Some(2025));
        assert_eq!(report.assets.len(), 2);
        assert_eq!(report.assets[0].value.maximum, Some(500_000.0));
        assert_eq!(report.assets[1].owner_type, "spouse");
        assert_eq!(report.assets[1].ticker.as_deref(), Some("AAPL"));
        assert_eq!(report.liabilities.len(), 1);
        assert_eq!(report.liabilities[0].amount.maximum, Some(500_000.0));
    }

    #[test]
    fn net_worth_uses_conservative_cross_bounds() {
        let assets = vec![ParsedAnnualAsset {
            owner_type: "self".to_string(),
            asset_name: "Asset".to_string(),
            asset_type_code: None,
            ticker: None,
            value: parse_disclosure_range("$100,001 - $250,000").unwrap(),
            raw_text: String::new(),
        }];
        let liabilities = vec![ParsedAnnualLiability {
            owner_type: "self".to_string(),
            creditor_name: "Bank".to_string(),
            date_incurred: None,
            liability_type: "Mortgage".to_string(),
            amount: parse_disclosure_range("$15,001 - $50,000").unwrap(),
            raw_text: String::new(),
        }];
        let snapshot = calculate_reported_net_worth(&assets, &liabilities).unwrap();
        assert_eq!(snapshot.net_worth_minimum, Some(50_001.0));
        assert_eq!(snapshot.net_worth_maximum, Some(234_999.0));
    }

    #[test]
    fn asset_value_does_not_consume_adjacent_income_range() {
        let text = r#"S                  A: A
Asset                                                                   Owner Value of Asset
681 S Richmond Ave, [RP]                                            $250,001 -             Rent                   $2,501 - $5,000
                                                                    $500,000
S                 E: P"#;
        let report = parse_house_annual_text(text);
        assert_eq!(report.assets.len(), 1);
        assert_eq!(report.assets[0].value.minimum, 250_001.0);
        assert_eq!(report.assets[0].value.maximum, Some(500_000.0));
    }

    #[test]
    fn parses_income_positions_and_gifts_from_house_layout() {
        let text = r#"S                  C: E                 I
Source                                                        Type                                      Amount
Catholic University of America                                Teaching                                  $2,180.00
Muhammad Ali Foundation                                       Spouse Salary                             N/A
S                  E: P
Position                                         Name of Organization
National Spokesperson                            Rainbow PUSH Coalition
Board Member                                     3e, LLC
S                  G: G
Source                                                  Description                                      Value
Gil Arranza (Dallas, TX, US)                            sporting event ticket                            $3,500.00
Joseph Sanberg (Los Angeles, CA, US)                    gift of care                                     $3,660.30
S                  H: T"#;

        let report = parse_house_annual_text(text);

        assert_eq!(report.income.len(), 2);
        assert_eq!(
            report.income[0].amount.as_ref().map(|value| value.minimum),
            Some(2_180.0)
        );
        assert_eq!(report.income[1].owner_type, "spouse");
        assert!(report.income[1].amount.is_none());
        assert_eq!(report.positions.len(), 2);
        assert_eq!(
            report.positions[0].organization_name,
            "Rainbow PUSH Coalition"
        );
        assert_eq!(report.gifts.len(), 2);
        assert_eq!(
            report.gifts[1].value.as_ref().map(|value| value.minimum),
            Some(3_660.30)
        );
    }
}
