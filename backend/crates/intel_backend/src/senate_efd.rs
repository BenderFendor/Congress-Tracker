//! Deterministic helpers for the Senate electronic Financial Disclosure site.
//!
//! The eFD site is a terms-gated Django/DataTables application rather than a
//! bulk file feed. This module keeps discovery separate from parsing: report
//! links and the exact JSON response are staged first, so parser changes never
//! require re-querying the public search endpoint.

use chrono::Datelike;
use serde_json::Value;

use crate::annual_disclosures::{
    parse_disclosure_range, ParsedAnnualAsset, ParsedAnnualGift, ParsedAnnualIncome,
    ParsedAnnualLiability, ParsedAnnualPosition, ParsedAnnualReport,
};

pub const HOME_URL: &str = "https://efdsearch.senate.gov/search/home/";
pub const DATA_URL: &str = "https://efdsearch.senate.gov/search/report/data/";

pub const TERMS_ACCEPTANCE_ENV: &str = "SENATE_EFD_ACCEPT_TERMS";

pub fn operator_terms_accepted(value: Option<&str>) -> bool {
    value == Some("1")
}

pub fn coverage_status(report_count: usize, terms_accepted: bool) -> &'static str {
    coverage_status_detailed(report_count, terms_accepted, 0, 0)
}

/// Public coverage states are deliberately mutually exclusive. A discovered
/// report with no unique member match is not a missing filing, and a parser
/// failure is not evidence that the filing was empty.
pub fn coverage_status_detailed(
    report_count: usize,
    terms_accepted: bool,
    ambiguous_identity_count: usize,
    parser_failure_count: usize,
) -> &'static str {
    if parser_failure_count > 0 {
        "parser_failure"
    } else if ambiguous_identity_count > 0 {
        "ambiguous_identity"
    } else if report_count > 0 {
        "loaded"
    } else if terms_accepted {
        "missing_filing"
    } else {
        "missing_consent"
    }
}

pub fn storage_dir() -> std::path::PathBuf {
    std::env::var("WORKER_STORAGE_DIR")
        .ok()
        .filter(|path| !path.trim().is_empty())
        .map(|path| std::path::PathBuf::from(path).join("senate_efd"))
        .unwrap_or_else(|| std::path::PathBuf::from("./worker_storage/senate_efd"))
}

pub fn looks_like_terms_page(body: &str) -> bool {
    body.contains("prohibition_agreement") || body.contains("agree to the following terms")
}

pub fn discovery_year_is_terminal(
    year: i32,
    window_start: chrono::NaiveDate,
    window_end: chrono::NaiveDate,
    today: chrono::NaiveDate,
) -> bool {
    let Some(year_start) = chrono::NaiveDate::from_ymd_opt(year, 1, 1) else {
        return false;
    };
    let required_end = if year == today.year() {
        today
    } else {
        let Some(year_end) = chrono::NaiveDate::from_ymd_opt(year, 12, 31) else {
            return false;
        };
        year_end
    };
    window_start <= year_start && window_end >= required_end
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SenateReportLink {
    pub source_report_id: String,
    pub filer_name: String,
    pub report_type: String,
    pub report_url: String,
    pub submitted_date: Option<chrono::NaiveDate>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SenateDiscoveryPage {
    pub links: Vec<SenateReportLink>,
    pub records_filtered: Option<usize>,
    pub row_count: usize,
}

/// Provider pagination state. Completion is accepted only after every row the
/// provider advertised has been returned; an empty or short intermediate page
/// is a truncation error, never a successful terminal page.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct SenateDiscoveryProgress {
    pub next_start: usize,
    pub expected_total: Option<usize>,
    seen_report_ids: std::collections::HashSet<String>,
}

impl SenateDiscoveryProgress {
    pub fn observe_report_identities(&mut self, links: &[SenateReportLink]) -> Result<(), String> {
        for link in links {
            if !self.seen_report_ids.insert(link.source_report_id.clone()) {
                return Err(format!(
                    "Senate eFD repeated report identity {} across discovery pages",
                    link.source_report_id
                ));
            }
        }
        Ok(())
    }

    pub fn observe_page(
        &mut self,
        page: &SenateDiscoveryPage,
        requested_length: usize,
    ) -> Result<bool, String> {
        if requested_length == 0 {
            return Err("Senate eFD page length must be positive".to_string());
        }
        let total = page.records_filtered.ok_or_else(|| {
            "Senate eFD discovery omitted its total row count; exhaustive completion cannot be proved"
                .to_string()
        })?;
        if let Some(expected) = self.expected_total {
            if total != expected {
                return Err(format!(
                    "Senate eFD discovery total changed during pagination ({expected} to {total})"
                ));
            }
        } else {
            self.expected_total = Some(total);
        }
        if self.next_start > total {
            return Err("Senate eFD pagination advanced beyond the advertised total".to_string());
        }
        let remaining = total.saturating_sub(self.next_start);
        if page.row_count > requested_length || page.row_count > remaining {
            return Err(
                "Senate eFD returned more rows than the requested or remaining page size"
                    .to_string(),
            );
        }
        self.next_start += page.row_count;
        if self.next_start == total {
            return Ok(true);
        }
        if page.row_count < requested_length {
            return Err(format!(
                "Senate eFD truncated discovery at {} of {total} rows",
                self.next_start
            ));
        }
        Ok(false)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct SenateTransaction {
    pub owner_type: String,
    pub asset_name: String,
    pub ticker: Option<String>,
    pub transaction_type: String,
    pub transaction_date: Option<chrono::NaiveDate>,
    pub amount_min: Option<f64>,
    pub amount_max: Option<f64>,
    pub raw_text: String,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct ParsedSenateReport {
    pub transactions: Vec<SenateTransaction>,
    pub annual: ParsedAnnualReport,
}

pub fn parse_report_html(report_type: &str, html: &str) -> ParsedSenateReport {
    let tables = html_tables(html);
    let mut parsed = ParsedSenateReport::default();
    for table in tables {
        let Some(headers) = table.first() else {
            continue;
        };
        let normalized = headers
            .iter()
            .map(|header| header.to_ascii_lowercase())
            .collect::<Vec<_>>();
        if report_type.eq_ignore_ascii_case("PTR")
            || normalized
                .iter()
                .any(|header| header.contains("transaction type"))
        {
            parse_transaction_table(&table, &normalized, &mut parsed.transactions);
        } else if normalized.iter().any(|header| header.contains("creditor")) {
            parse_liability_table(&table, &normalized, &mut parsed.annual.liabilities);
        } else if normalized.iter().any(|header| header.contains("position"))
            && normalized
                .iter()
                .any(|header| header.contains("organization"))
        {
            parse_position_table(&table, &normalized, &mut parsed.annual.positions);
        } else if normalized.iter().any(|header| header.contains("gift"))
            || normalized
                .iter()
                .any(|header| header.contains("description"))
                && normalized.iter().any(|header| header.contains("value"))
        {
            parse_gift_table(&table, &normalized, &mut parsed.annual.gifts);
        } else if normalized
            .iter()
            .any(|header| header.contains("income type"))
        {
            parse_income_table(&table, &normalized, &mut parsed.annual.income);
        } else if normalized.iter().any(|header| header.contains("asset"))
            && normalized.iter().any(|header| header.contains("value"))
        {
            parse_asset_table(&table, &normalized, &mut parsed.annual.assets);
        }
    }
    parsed
}

pub fn parse_report_html_checked(
    report_type: &str,
    html: &str,
) -> Result<ParsedSenateReport, String> {
    if looks_like_terms_page(html) {
        return Err("Senate eFD returned the terms agreement instead of a report".to_string());
    }
    if html_tables(html).is_empty() {
        return Err("Senate eFD report contains no parseable tables".to_string());
    }
    let parsed = parse_report_html(report_type, html);
    let parsed_rows = parsed.transactions.len()
        + parsed.annual.assets.len()
        + parsed.annual.liabilities.len()
        + parsed.annual.income.len()
        + parsed.annual.gifts.len()
        + parsed.annual.positions.len();
    if parsed_rows == 0 {
        return Err(format!(
            "Senate eFD {report_type} report contains no supported disclosure rows"
        ));
    }
    Ok(parsed)
}

pub fn parse_report_text(report_type: &str, text: &str) -> ParsedSenateReport {
    if report_type.eq_ignore_ascii_case("PTR") {
        let transactions = crate::disclosures::parse_house_ptr_text(text)
            .into_iter()
            .map(|row| SenateTransaction {
                owner_type: row.owner_type,
                asset_name: row.asset_name,
                ticker: row.ticker,
                transaction_type: row.transaction_type,
                transaction_date: row.transaction_date,
                amount_min: row.amount_min,
                amount_max: row.amount_max,
                raw_text: row.raw_text,
            })
            .collect();
        ParsedSenateReport {
            transactions,
            annual: ParsedAnnualReport::default(),
        }
    } else {
        ParsedSenateReport {
            transactions: Vec::new(),
            annual: crate::annual_disclosures::parse_house_annual_text(text),
        }
    }
}

pub fn parse_report_text_checked(
    report_type: &str,
    text: &str,
) -> Result<ParsedSenateReport, String> {
    if text.trim().is_empty() {
        return Err("Senate eFD extracted report text is empty".to_string());
    }
    let parsed = parse_report_text(report_type, text);
    let parsed_rows = parsed.transactions.len()
        + parsed.annual.assets.len()
        + parsed.annual.liabilities.len()
        + parsed.annual.income.len()
        + parsed.annual.gifts.len()
        + parsed.annual.positions.len();
    if parsed_rows == 0 {
        return Err(format!(
            "Senate eFD {report_type} text contains no supported disclosure rows"
        ));
    }
    Ok(parsed)
}

fn html_tables(html: &str) -> Vec<Vec<Vec<String>>> {
    html.split("<table")
        .skip(1)
        .filter_map(|table| table.split_once("</table>").map(|(table, _)| table))
        .map(|table| {
            table
                .split("<tr")
                .skip(1)
                .filter_map(|row| row.split_once("</tr>").map(|(row, _)| row))
                .map(|row| {
                    row.split(['<'])
                        .filter_map(|fragment| {
                            let (tag, rest) = fragment.split_once('>')?;
                            (tag.starts_with("td") || tag.starts_with("th"))
                                .then(|| clean_html(rest.split('<').next().unwrap_or_default()))
                        })
                        .collect::<Vec<_>>()
                })
                .filter(|row| !row.is_empty())
                .collect::<Vec<_>>()
        })
        .filter(|table| !table.is_empty())
        .collect()
}

fn clean_html(value: &str) -> String {
    strip_tags(value)
        .replace("&amp;", "&")
        .replace("&nbsp;", " ")
        .replace("&#39;", "'")
        .replace("&quot;", "\"")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn index(headers: &[String], names: &[&str]) -> Option<usize> {
    headers
        .iter()
        .position(|header| names.iter().any(|name| header.contains(name)))
}

fn cell<'a>(row: &'a [String], headers: &[String], names: &[&str]) -> Option<&'a str> {
    row.get(index(headers, names)?).map(String::as_str)
}

fn owner(value: Option<&str>) -> String {
    match value.unwrap_or_default().to_ascii_lowercase().as_str() {
        value if value.contains("spouse") => "spouse",
        value if value.contains("joint") => "joint",
        value if value.contains("child") || value.contains("dependent") => "dependent",
        _ => "self",
    }
    .to_string()
}

fn parse_date(value: Option<&str>) -> Option<chrono::NaiveDate> {
    let value = value?.trim();
    ["%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d"]
        .iter()
        .find_map(|format| chrono::NaiveDate::parse_from_str(value, format).ok())
}

fn parse_transaction_table(
    table: &[Vec<String>],
    headers: &[String],
    output: &mut Vec<SenateTransaction>,
) {
    for row in &table[1..] {
        let Some(asset_name) = cell(row, headers, &["asset name", "asset"]) else {
            continue;
        };
        let Some(transaction_type) = cell(row, headers, &["transaction type", "type"]) else {
            continue;
        };
        let amount = cell(row, headers, &["amount"]).and_then(parse_disclosure_range);
        output.push(SenateTransaction {
            owner_type: owner(cell(row, headers, &["owner"])),
            asset_name: asset_name.to_string(),
            ticker: cell(row, headers, &["ticker"])
                .filter(|ticker| !ticker.is_empty())
                .map(str::to_string),
            transaction_type: transaction_type.to_string(),
            transaction_date: parse_date(cell(row, headers, &["transaction date", "date"])),
            amount_min: amount.as_ref().map(|amount| amount.minimum),
            amount_max: amount.and_then(|amount| amount.maximum),
            raw_text: row.join(" | "),
        });
    }
}

fn parse_asset_table(
    table: &[Vec<String>],
    headers: &[String],
    output: &mut Vec<ParsedAnnualAsset>,
) {
    for row in &table[1..] {
        let Some(asset_name) = cell(row, headers, &["asset name", "asset"]) else {
            continue;
        };
        let Some(value) = cell(row, headers, &["value"]).and_then(parse_disclosure_range) else {
            continue;
        };
        output.push(ParsedAnnualAsset {
            owner_type: owner(cell(row, headers, &["owner"])),
            asset_name: asset_name.to_string(),
            asset_type_code: None,
            ticker: cell(row, headers, &["ticker"])
                .filter(|value| !value.is_empty())
                .map(str::to_string),
            value,
            raw_text: row.join(" | "),
        });
    }
}

fn parse_liability_table(
    table: &[Vec<String>],
    headers: &[String],
    output: &mut Vec<ParsedAnnualLiability>,
) {
    for row in &table[1..] {
        let Some(creditor) = cell(row, headers, &["creditor"]) else {
            continue;
        };
        let Some(amount) = cell(row, headers, &["amount"]).and_then(parse_disclosure_range) else {
            continue;
        };
        output.push(ParsedAnnualLiability {
            owner_type: owner(cell(row, headers, &["owner"])),
            creditor_name: creditor.to_string(),
            date_incurred: cell(row, headers, &["date incurred"]).map(str::to_string),
            liability_type: cell(row, headers, &["type"])
                .unwrap_or("Liability")
                .to_string(),
            amount,
            raw_text: row.join(" | "),
        });
    }
}

fn parse_income_table(
    table: &[Vec<String>],
    headers: &[String],
    output: &mut Vec<ParsedAnnualIncome>,
) {
    for row in &table[1..] {
        let Some(source) = cell(row, headers, &["source"]) else {
            continue;
        };
        output.push(ParsedAnnualIncome {
            owner_type: owner(cell(row, headers, &["owner"])),
            source_description: source.to_string(),
            income_type: cell(row, headers, &["income type", "type"])
                .unwrap_or("Income")
                .to_string(),
            amount: cell(row, headers, &["amount"]).and_then(parse_disclosure_range),
            raw_text: row.join(" | "),
        });
    }
}

fn parse_gift_table(table: &[Vec<String>], headers: &[String], output: &mut Vec<ParsedAnnualGift>) {
    for row in &table[1..] {
        let Some(source) = cell(row, headers, &["source"]) else {
            continue;
        };
        output.push(ParsedAnnualGift {
            owner_type: owner(cell(row, headers, &["owner"])),
            source_description: source.to_string(),
            gift_type: cell(row, headers, &["description", "gift"])
                .unwrap_or("Gift")
                .to_string(),
            value: cell(row, headers, &["value"]).and_then(parse_disclosure_range),
            raw_text: row.join(" | "),
        });
    }
}

fn parse_position_table(
    table: &[Vec<String>],
    headers: &[String],
    output: &mut Vec<ParsedAnnualPosition>,
) {
    for row in &table[1..] {
        let Some(organization) = cell(row, headers, &["organization"]) else {
            continue;
        };
        output.push(ParsedAnnualPosition {
            owner_type: owner(cell(row, headers, &["owner"])),
            organization_name: organization.to_string(),
            position_title: cell(row, headers, &["position", "title"])
                .unwrap_or("Position")
                .to_string(),
            raw_text: row.join(" | "),
        });
    }
}

pub async fn persist_parsed_report(
    pool: &sqlx::PgPool,
    document_id: i64,
    document_version_id: i64,
    link: &SenateReportLink,
    parsed: &ParsedSenateReport,
) -> Result<i64, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    sqlx::query("DELETE FROM disclosure_transactions WHERE document_id=$1")
        .bind(document_id)
        .execute(&mut *transaction)
        .await?;
    let mut written = 0i64;
    for (index, row) in parsed.transactions.iter().enumerate() {
        written += sqlx::query(
            r#"INSERT INTO disclosure_transactions
               (document_id,owner_type,asset_name,ticker,transaction_type,amount_min,
                amount_max,transaction_date,disclosure_date,filing_url,raw_json)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT DO NOTHING"#,
        )
        .bind(document_id)
        .bind(&row.owner_type)
        .bind(&row.asset_name)
        .bind(&row.ticker)
        .bind(&row.transaction_type)
        .bind(row.amount_min)
        .bind(row.amount_max)
        .bind(row.transaction_date)
        .bind(link.submitted_date)
        .bind(&link.report_url)
        .bind(serde_json::json!({
            "source": "senate_efd",
            "source_report_id": link.source_report_id,
            "row_index": index,
            "raw_text": row.raw_text,
            "parser_name": "senate_efd_html",
            "parser_version": "1.0",
        }))
        .execute(&mut *transaction)
        .await?
        .rows_affected() as i64;
    }
    let annual_rows = parsed.annual.assets.len()
        + parsed.annual.liabilities.len()
        + parsed.annual.income.len()
        + parsed.annual.gifts.len()
        + parsed.annual.positions.len();
    if annual_rows > 0 {
        let filing_id: i64 = sqlx::query_scalar(
            r#"INSERT INTO disclosure_filings
               (document_id,document_version_id,filing_type,source_filing_type_code,
                filing_date,reporting_period_end,raw_json)
               VALUES ($1,$2,'annual_report',$3,$4,$4,$5)
               ON CONFLICT (document_version_id) WHERE document_version_id IS NOT NULL
               DO UPDATE SET filing_date=EXCLUDED.filing_date,
                             reporting_period_end=EXCLUDED.reporting_period_end,
                             raw_json=EXCLUDED.raw_json
               RETURNING filing_id"#,
        )
        .bind(document_id)
        .bind(document_version_id)
        .bind(&link.report_type)
        .bind(link.submitted_date)
        .bind(serde_json::json!({
            "source": "senate_efd",
            "source_report_id": link.source_report_id,
            "source_url": link.report_url,
        }))
        .fetch_one(&mut *transaction)
        .await?;
        for table in [
            "disclosure_assets",
            "disclosure_liabilities",
            "disclosure_income",
            "disclosure_gifts",
            "disclosure_positions",
        ] {
            sqlx::query(&format!("DELETE FROM {table} WHERE document_version_id=$1"))
                .bind(document_version_id)
                .execute(&mut *transaction)
                .await?;
        }
        for row in &parsed.annual.assets {
            written += sqlx::query(
                r#"INSERT INTO disclosure_assets
                   (document_version_id,filing_id,owner_type,asset_name,ticker,asset_type,
                    value_min,value_max,value_is_unbounded,raw_text,raw_row,
                    parser_name,parser_version,parse_confidence)
                   VALUES ($1,$2,$3,$4,$5,'other_asset',$6,$7,$8,$9,$10,
                           'senate_efd_html','1.0','medium')"#,
            )
            .bind(document_version_id)
            .bind(filing_id)
            .bind(&row.owner_type)
            .bind(&row.asset_name)
            .bind(&row.ticker)
            .bind(row.value.minimum)
            .bind(row.value.maximum)
            .bind(row.value.is_unbounded)
            .bind(&row.raw_text)
            .bind(serde_json::json!({"range": row.value.raw}))
            .execute(&mut *transaction)
            .await?
            .rows_affected() as i64;
        }
        for row in &parsed.annual.liabilities {
            written += sqlx::query(
                r#"INSERT INTO disclosure_liabilities
                   (document_version_id,filing_id,owner_type,creditor_name,liability_type,
                    date_incurred,amount_min,amount_max,amount_is_unbounded,raw_text,raw_row,
                    parser_name,parser_version,parse_confidence)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                           'senate_efd_html','1.0','medium')"#,
            )
            .bind(document_version_id)
            .bind(filing_id)
            .bind(&row.owner_type)
            .bind(&row.creditor_name)
            .bind(&row.liability_type)
            .bind(&row.date_incurred)
            .bind(row.amount.minimum)
            .bind(row.amount.maximum)
            .bind(row.amount.is_unbounded)
            .bind(&row.raw_text)
            .bind(serde_json::json!({"range": row.amount.raw}))
            .execute(&mut *transaction)
            .await?
            .rows_affected() as i64;
        }
        for row in &parsed.annual.income {
            written += sqlx::query(
                r#"INSERT INTO disclosure_income
                   (document_version_id,filing_id,owner_type,source_description,income_type,
                    amount_min,amount_max,raw_text,parser_name,parser_version,parse_confidence)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'senate_efd_html','1.0','medium')"#,
            )
            .bind(document_version_id)
            .bind(filing_id)
            .bind(&row.owner_type)
            .bind(&row.source_description)
            .bind(&row.income_type)
            .bind(row.amount.as_ref().map(|value| value.minimum))
            .bind(row.amount.as_ref().and_then(|value| value.maximum))
            .bind(&row.raw_text)
            .execute(&mut *transaction)
            .await?
            .rows_affected() as i64;
        }
        for row in &parsed.annual.gifts {
            written += sqlx::query(
                r#"INSERT INTO disclosure_gifts
                   (document_version_id,filing_id,owner_type,source_description,gift_type,
                    value_min,value_max,raw_text,parser_name,parser_version,parse_confidence)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'senate_efd_html','1.0','medium')"#,
            )
            .bind(document_version_id)
            .bind(filing_id)
            .bind(&row.owner_type)
            .bind(&row.source_description)
            .bind(&row.gift_type)
            .bind(row.value.as_ref().map(|value| value.minimum))
            .bind(row.value.as_ref().and_then(|value| value.maximum))
            .bind(&row.raw_text)
            .execute(&mut *transaction)
            .await?
            .rows_affected() as i64;
        }
        for row in &parsed.annual.positions {
            written += sqlx::query(
                r#"INSERT INTO disclosure_positions
                   (document_version_id,filing_id,owner_type,organization_name,position_title,
                    raw_text,parser_name,parser_version,parse_confidence)
                   VALUES ($1,$2,$3,$4,$5,$6,'senate_efd_html','1.0','medium')"#,
            )
            .bind(document_version_id)
            .bind(filing_id)
            .bind(&row.owner_type)
            .bind(&row.organization_name)
            .bind(&row.position_title)
            .bind(&row.raw_text)
            .execute(&mut *transaction)
            .await?
            .rows_affected() as i64;
        }
    }
    transaction.commit().await?;
    Ok(written)
}

pub fn extract_csrf_token(html: &str) -> Option<String> {
    let marker = "name=\"csrfmiddlewaretoken\" value=\"";
    let start = html.find(marker)? + marker.len();
    let end = html[start..].find('\"')? + start;
    (!html[start..end].is_empty()).then(|| html[start..end].to_string())
}

/// Recursively extract report links from the DataTables JSON response. The
/// response has changed row nesting over time, so relying on one fixed array
/// index would silently drop filings.
pub fn extract_report_links(payload: &Value) -> Vec<SenateReportLink> {
    let mut links = Vec::new();
    collect_links(payload, &mut links);
    links.sort_by(|left, right| left.source_report_id.cmp(&right.source_report_id));
    links.dedup_by(|left, right| left.source_report_id == right.source_report_id);
    links
}

pub fn parse_discovery_page(payload: &Value) -> Result<SenateDiscoveryPage, String> {
    let object = payload
        .as_object()
        .ok_or_else(|| "Senate eFD discovery payload is not a JSON object".to_string())?;
    let rows = object
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| "Senate eFD discovery payload is missing its data array".to_string())?;
    let records_filtered = object
        .get("recordsFiltered")
        .or_else(|| object.get("recordsTotal"))
        .map(|value| {
            value
                .as_u64()
                .and_then(|count| usize::try_from(count).ok())
                .ok_or_else(|| {
                    "Senate eFD discovery record count is not a non-negative integer".to_string()
                })
        })
        .transpose()?;
    let mut links = Vec::with_capacity(rows.len());
    for (index, row) in rows.iter().enumerate() {
        let row_links = extract_report_links(row);
        if row_links.len() != 1 {
            return Err(format!(
                "Senate eFD discovery row {index} produced {} report identities; expected exactly one",
                row_links.len()
            ));
        }
        links.push(
            row_links
                .into_iter()
                .next()
                .expect("one link checked above"),
        );
    }
    let mut identities = std::collections::HashSet::with_capacity(links.len());
    if links
        .iter()
        .any(|link| !identities.insert(link.source_report_id.as_str()))
    {
        return Err("Senate eFD discovery page contains duplicate report identities".to_string());
    }
    Ok(SenateDiscoveryPage {
        links,
        records_filtered,
        row_count: rows.len(),
    })
}

fn collect_links(value: &Value, links: &mut Vec<SenateReportLink>) {
    match value {
        Value::String(text) => {
            let mut cursor = 0;
            while let Some(relative) = text[cursor..].find("/search/view/") {
                let start = cursor + relative;
                let Some(end_relative) = text[start..].find('"') else {
                    break;
                };
                let end = start + end_relative;
                let path = &text[start..end];
                let source_report_id = path
                    .trim_end_matches('/')
                    .rsplit('/')
                    .next()
                    .unwrap_or_default()
                    .to_string();
                if !source_report_id.is_empty() {
                    let report_type = path
                        .split('/')
                        .nth(3)
                        .unwrap_or("unknown")
                        .to_ascii_uppercase();
                    let filer_name = text[end..]
                        .find('>')
                        .map(|offset| end + offset + 1)
                        .and_then(|anchor_start| {
                            text[anchor_start..]
                                .find('<')
                                .map(|offset| &text[anchor_start..anchor_start + offset])
                        })
                        .map(strip_tags)
                        .unwrap_or_default();
                    links.push(SenateReportLink {
                        source_report_id,
                        filer_name: if filer_name.is_empty() {
                            "Unknown filer".to_string()
                        } else {
                            filer_name
                        },
                        report_type,
                        report_url: format!("https://efdsearch.senate.gov{path}"),
                        submitted_date: None,
                    });
                }
                cursor = end;
            }
        }
        Value::Array(values) => {
            let first_link = links.len();
            values.iter().for_each(|item| collect_links(item, links));
            let row_contains_report_link = values.iter().any(|item| {
                item.as_str()
                    .is_some_and(|text| text.contains("/search/view/"))
            });
            if row_contains_report_link {
                if let Some(date) = values.iter().find_map(find_date) {
                    for link in &mut links[first_link..] {
                        link.submitted_date = Some(date);
                    }
                }
            }
        }
        Value::Object(values) => values.values().for_each(|item| collect_links(item, links)),
        _ => {}
    }
}

fn find_date(value: &Value) -> Option<chrono::NaiveDate> {
    match value {
        Value::String(value) => {
            let value = strip_tags(value);
            value.split_whitespace().find_map(|candidate| {
                let candidate = candidate.trim_matches(|character: char| {
                    !character.is_ascii_digit() && character != '/'
                });
                chrono::NaiveDate::parse_from_str(candidate, "%m/%d/%Y")
                    .or_else(|_| chrono::NaiveDate::parse_from_str(candidate, "%m/%d/%y"))
                    .ok()
            })
        }
        Value::Array(values) => values.iter().find_map(find_date),
        Value::Object(values) => values.values().find_map(find_date),
        _ => None,
    }
}

fn strip_tags(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut in_tag = false;
    for character in value.chars() {
        match character {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(character),
            _ => {}
        }
    }
    output.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn extracts_csrf_without_accepting_missing_tokens() {
        assert_eq!(
            extract_csrf_token("<input name=\"csrfmiddlewaretoken\" value=\"abc123\">"),
            Some("abc123".to_string())
        );
        assert_eq!(extract_csrf_token("<form></form>"), None);
        assert!(looks_like_terms_page(
            "<input name=\"prohibition_agreement\">"
        ));
        assert!(!looks_like_terms_page("<table>report</table>"));
    }

    #[test]
    fn terms_acceptance_and_coverage_states_are_explicit() {
        assert!(!operator_terms_accepted(None));
        assert!(!operator_terms_accepted(Some("true")));
        assert!(operator_terms_accepted(Some("1")));
        assert_eq!(coverage_status(0, false), "missing_consent");
        assert_eq!(coverage_status(0, true), "missing_filing");
        assert_eq!(coverage_status(4, false), "loaded");
        assert_eq!(coverage_status(4, true), "loaded");
    }

    #[test]
    fn extracts_and_deduplicates_nested_report_links() {
        let payload = json!({"data": [["<a href=\"/search/view/ptr/abc-123/\">Senator Example</a>", "05/12/2026"], ["<a href=\"/search/view/ptr/abc-123/\">duplicate</a>"] ]});
        let links = extract_report_links(&payload);
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].source_report_id, "abc-123");
        assert_eq!(links[0].report_type, "PTR");
        assert_eq!(links[0].filer_name, "Senator Example");
        assert!(links[0].report_url.ends_with("/search/view/ptr/abc-123/"));
        assert_eq!(
            links[0].submitted_date,
            chrono::NaiveDate::from_ymd_opt(2026, 5, 12)
        );
    }

    #[test]
    fn parses_paginated_discovery_fixtures_and_deduplicates_across_pages() {
        let first: Value = serde_json::from_str(include_str!(
            "../tests/fixtures/senate_efd/discovery_page_1.json"
        ))
        .expect("page one fixture is valid JSON");
        let second: Value = serde_json::from_str(include_str!(
            "../tests/fixtures/senate_efd/discovery_page_2.json"
        ))
        .expect("page two fixture is valid JSON");
        let page_one = parse_discovery_page(&first).expect("page one should parse");
        let page_two = parse_discovery_page(&second).expect("page two should parse");
        assert_eq!(page_one.records_filtered, Some(3));
        assert_eq!(page_two.records_filtered, Some(3));
        let mut links = page_one
            .links
            .into_iter()
            .chain(page_two.links)
            .collect::<Vec<_>>();
        links.sort_by(|left, right| left.source_report_id.cmp(&right.source_report_id));
        links.dedup_by(|left, right| left.source_report_id == right.source_report_id);
        assert_eq!(
            links
                .iter()
                .map(|link| link.source_report_id.as_str())
                .collect::<Vec<_>>(),
            vec!["annual-002", "ptr-001", "ptr-003"]
        );
        assert_eq!(links[0].report_type, "ANNUAL");
        assert_eq!(
            links[2].submitted_date,
            chrono::NaiveDate::from_ymd_opt(2026, 5, 11)
        );
    }

    #[test]
    fn pagination_exhausts_more_than_one_thousand_rows() {
        let mut progress = SenateDiscoveryProgress::default();
        for page_index in 0..10 {
            let page = SenateDiscoveryPage {
                links: Vec::new(),
                records_filtered: Some(1_205),
                row_count: 100,
            };
            assert!(!progress.observe_page(&page, 100).unwrap());
            assert_eq!(progress.next_start, (page_index + 1) * 100);
        }
        let page = SenateDiscoveryPage {
            links: Vec::new(),
            records_filtered: Some(1_205),
            row_count: 100,
        };
        assert!(!progress.observe_page(&page, 100).unwrap());
        let page = SenateDiscoveryPage {
            links: Vec::new(),
            records_filtered: Some(1_205),
            row_count: 100,
        };
        assert!(!progress.observe_page(&page, 100).unwrap());
        let terminal = SenateDiscoveryPage {
            links: Vec::new(),
            records_filtered: Some(1_205),
            row_count: 5,
        };
        assert!(progress.observe_page(&terminal, 100).unwrap());
        assert_eq!(progress.next_start, 1_205);
    }

    #[test]
    fn pagination_rejects_truncated_or_unverifiable_success() {
        let mut progress = SenateDiscoveryProgress::default();
        let short = SenateDiscoveryPage {
            links: Vec::new(),
            records_filtered: Some(1_205),
            row_count: 5,
        };
        let error = progress.observe_page(&short, 100).unwrap_err();
        assert!(error.contains("truncated discovery at 5 of 1205"));

        let mut progress = SenateDiscoveryProgress::default();
        let missing_total = SenateDiscoveryPage {
            links: Vec::new(),
            records_filtered: None,
            row_count: 0,
        };
        assert!(progress.observe_page(&missing_total, 100).is_err());
    }

    #[test]
    fn pagination_rejects_duplicate_identity_across_pages() {
        fn link(id: &str) -> SenateReportLink {
            SenateReportLink {
                source_report_id: id.to_string(),
                filer_name: "Example Senator".to_string(),
                report_type: "PTR".to_string(),
                report_url: format!("https://efdsearch.senate.gov/search/view/ptr/{id}/"),
                submitted_date: None,
            }
        }

        let mut progress = SenateDiscoveryProgress::default();
        progress
            .observe_report_identities(&[link("ptr-001"), link("ptr-002")])
            .unwrap();
        let error = progress
            .observe_report_identities(&[link("ptr-002"), link("ptr-003")])
            .expect_err("a repeated identity on page two must fail discovery");
        assert!(error.contains("repeated report identity ptr-002"));
    }

    #[test]
    fn terminal_years_require_complete_calendar_or_current_to_date_windows() {
        let today = chrono::NaiveDate::from_ymd_opt(2026, 7, 12).unwrap();
        let full_start = chrono::NaiveDate::from_ymd_opt(2012, 1, 1).unwrap();
        assert!(discovery_year_is_terminal(2012, full_start, today, today));
        assert!(discovery_year_is_terminal(2026, full_start, today, today));
        assert!(!discovery_year_is_terminal(
            2012,
            chrono::NaiveDate::from_ymd_opt(2012, 2, 1).unwrap(),
            today,
            today
        ));
        assert!(!discovery_year_is_terminal(
            2025,
            full_start,
            chrono::NaiveDate::from_ymd_opt(2025, 12, 30).unwrap(),
            today
        ));
    }

    #[test]
    fn malformed_discovery_payloads_fail_loudly() {
        assert!(parse_discovery_page(&json!([])).is_err());
        assert!(parse_discovery_page(&json!({"recordsFiltered": 2})).is_err());
        assert!(parse_discovery_page(&json!({
            "recordsFiltered": "two",
            "data": []
        }))
        .is_err());
        assert!(parse_discovery_page(&json!({
            "recordsFiltered": 1,
            "data": [["unexpected markup", "05/12/2026"]]
        }))
        .is_err());
        let mixed = parse_discovery_page(&json!({
            "recordsFiltered": 2,
            "data": [
                ["<a href=\"/search/view/ptr/valid-001/\">Valid Filer</a>", "05/12/2026"],
                ["provider row without a report link", "05/11/2026"]
            ]
        }))
        .expect_err("one malformed row must invalidate the complete page");
        assert!(mixed.contains("row 1 produced 0 report identities"));
    }

    #[test]
    fn parses_senate_ptr_and_annual_html_tables() {
        let ptr = include_str!("../tests/fixtures/senate_efd/ptr_report.html");
        let parsed = parse_report_html_checked("PTR", ptr).expect("PTR fixture should parse");
        assert_eq!(parsed.transactions.len(), 1);
        assert_eq!(parsed.transactions[0].asset_name, "Acme & Company");
        assert_eq!(parsed.transactions[0].amount_min, Some(1_001.0));
        assert_eq!(parsed.transactions[0].amount_max, Some(15_000.0));

        let annual = include_str!("../tests/fixtures/senate_efd/annual_report.html");
        let parsed =
            parse_report_html_checked("ANNUAL", annual).expect("annual fixture should parse");
        assert_eq!(parsed.annual.assets.len(), 1);
        assert_eq!(parsed.annual.liabilities.len(), 1);
        assert_eq!(parsed.annual.income.len(), 1);
        assert_eq!(parsed.annual.gifts.len(), 1);
        assert_eq!(parsed.annual.positions.len(), 1);
    }

    #[test]
    fn checked_report_parser_rejects_terms_and_unsupported_markup() {
        assert!(parse_report_html_checked(
            "PTR",
            "<form><input name=\"prohibition_agreement\"></form>"
        )
        .is_err());
        assert!(parse_report_html_checked("PTR", "<html>not a report</html>").is_err());
        assert!(parse_report_html_checked(
            "PTR",
            "<table><tr><th>Unrecognized</th></tr><tr><td>value</td></tr></table>"
        )
        .is_err());
    }

    #[test]
    fn parses_extracted_pdf_text_and_rejects_malformed_text() {
        let ptr = include_str!("../tests/fixtures/senate_efd/ptr_report.txt");
        let parsed = parse_report_text_checked("PTR", ptr).expect("PTR text fixture should parse");
        assert_eq!(parsed.transactions.len(), 1);
        assert_eq!(parsed.transactions[0].owner_type, "self");
        assert_eq!(parsed.transactions[0].asset_name, "Acme Corp");
        assert_eq!(parsed.transactions[0].ticker.as_deref(), Some("ACME"));
        assert_eq!(parsed.transactions[0].amount_min, Some(1_001.0));
        assert_eq!(parsed.transactions[0].amount_max, Some(15_000.0));

        let annual = include_str!("../tests/fixtures/senate_efd/annual_report.txt");
        let parsed =
            parse_report_text_checked("ANNUAL", annual).expect("annual text fixture should parse");
        assert_eq!(parsed.annual.assets.len(), 1);
        assert_eq!(parsed.annual.liabilities.len(), 1);

        assert!(parse_report_text_checked("PTR", "").is_err());
        assert!(parse_report_text_checked("PTR", "unrecognized report text").is_err());
    }
}
#[test]
fn senate_coverage_states_do_not_collapse_distinct_failures() {
    assert_eq!(coverage_status_detailed(0, false, 0, 0), "missing_consent");
    assert_eq!(coverage_status_detailed(0, true, 0, 0), "missing_filing");
    assert_eq!(
        coverage_status_detailed(1, true, 1, 0),
        "ambiguous_identity"
    );
    assert_eq!(coverage_status_detailed(1, true, 0, 1), "parser_failure");
    assert_eq!(coverage_status_detailed(1, true, 0, 0), "loaded");
}
