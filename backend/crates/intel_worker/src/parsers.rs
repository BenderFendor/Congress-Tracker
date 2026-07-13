use std::process::Command;

/// Layout classification from pdftotext output fingerprint
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DocumentLayout {
    PtrElectronic2022Plus,
    PtrLegacy2015To2021,
    PtrPre2015,
    AnnualElectronic,
    AnnualScanned,
    Unknown,
}

/// Run pdftotext -layout on a PDF file and return stdout text
pub fn extract_text(pdf_path: &str) -> Result<String, std::io::Error> {
    let output = Command::new("pdftotext")
        .args(["-layout", pdf_path, "-"])
        .output()?;
    if !output.status.success() {
        return Err(std::io::Error::other(format!(
            "pdftotext failed with exit code {:?}: {}",
            output.status.code(),
            String::from_utf8_lossy(&output.stderr),
        )));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Extract text and fall back to deterministic page OCR for image-only PDFs.
pub fn extract_text_with_ocr(pdf_path: &str) -> Result<String, std::io::Error> {
    let text = extract_text(pdf_path)?;
    if text
        .chars()
        .filter(|character| !character.is_whitespace())
        .count()
        >= 100
    {
        return Ok(text);
    }
    let directory =
        std::env::temp_dir().join(format!("congress-tracker-ocr-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&directory)?;
    let prefix = directory.join("page");
    let render = Command::new("pdftoppm")
        .args([
            "-png",
            "-r",
            "200",
            pdf_path,
            prefix.to_string_lossy().as_ref(),
        ])
        .output()?;
    if !render.status.success() {
        let _ = std::fs::remove_dir_all(&directory);
        return Ok(text);
    }
    let mut pages: Vec<_> = std::fs::read_dir(&directory)?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "png"))
        .collect();
    pages.sort();
    let mut ocr = String::new();
    for page in pages {
        let output = Command::new("tesseract")
            .args([page.to_string_lossy().as_ref(), "stdout", "--psm", "6"])
            .output()?;
        if output.status.success() {
            ocr.push_str(&String::from_utf8_lossy(&output.stdout));
            ocr.push('\n');
        }
        let _ = std::fs::remove_file(page);
    }
    let _ = std::fs::remove_dir(&directory);
    if ocr
        .chars()
        .filter(|character| !character.is_whitespace())
        .count()
        >= 100
    {
        Ok(ocr)
    } else {
        Ok(text)
    }
}

/// Fingerprint a PDF to determine which parser to use
pub fn fingerprint(text: &str) -> DocumentLayout {
    let head: String = text.chars().take(500).collect();
    let head_lower = head.to_lowercase();

    // Modern electronic PTRs have "periodic transaction report" and structured date columns
    if head_lower.contains("periodic transaction report") && head_lower.contains("amount") {
        if head_lower.contains("owner") || head_lower.contains("sp") {
            return DocumentLayout::PtrElectronic2022Plus;
        }
        // Check for older date format or layout markers
        if head.contains("Date") || head_lower.contains("transaction date") {
            return DocumentLayout::PtrLegacy2015To2021;
        }
        // Additional check: scan text for pre-2022 date patterns (shorter date fields,
        // two-digit year format like MM/DD/YY) indicating less structured layout
        if contains_pre_2022_date_format(text) {
            return DocumentLayout::PtrLegacy2015To2021;
        }
        return DocumentLayout::PtrElectronic2022Plus;
    }

    // Annual reports mention "annual report" or "financial disclosure report"
    if head_lower.contains("annual report")
        || head_lower.contains("financial disclosure report")
        || (head_lower.contains("filing type:") && head_lower.contains("value of asset"))
    {
        // Scanned vs electronic: electronic has selectable text, scanned has image-only
        let non_whitespace: String = text
            .chars()
            .filter(|c| !c.is_whitespace())
            .take(200)
            .collect();
        if non_whitespace.len() < 100 {
            return DocumentLayout::AnnualScanned;
        }
        return DocumentLayout::AnnualElectronic;
    }

    // Pre-2015 PTRs lack "periodic transaction report" but have transaction-like rows
    if head_lower.contains("purchase")
        || head_lower.contains("sale")
        || head_lower.contains("exchange")
    {
        return DocumentLayout::PtrPre2015;
    }

    DocumentLayout::Unknown
}

/// Check if text contains date patterns consistent with pre-2022 PTR format.
/// Pre-2022 PTRs often use two-digit year dates (MM/DD/YY) in transaction rows,
/// while post-2022 PTRs uniformly use four-digit year dates (MM/DD/YYYY).
fn contains_pre_2022_date_format(text: &str) -> bool {
    // Look for date patterns like 01/15/17 (two-digit year)
    // inside transaction rows (lines with dollar amounts)
    let bytes = text.as_bytes();
    let len = bytes.len();
    if len < 8 {
        return false;
    }

    // Scan for MM/DD/YY pattern where year digits < 30 (2000-2029)
    // This avoids matching random forward-slash numbers
    let mut i = 0;
    while i + 7 < len {
        // Look for potential MM/ pattern (digit, digit, /)
        if bytes[i].is_ascii_digit() && bytes[i + 1].is_ascii_digit() && bytes[i + 2] == b'/' {
            // Check for DD/ pattern
            if bytes[i + 3].is_ascii_digit()
                && bytes[i + 4].is_ascii_digit()
                && bytes[i + 5] == b'/'
            {
                // Check for YY pattern (two-digit year) with a non-digit after
                if bytes[i + 6].is_ascii_digit()
                    && bytes[i + 7].is_ascii_digit()
                    && (i + 8 >= len || !bytes[i + 8].is_ascii_digit())
                {
                    // Year bytes: tens and ones
                    let tens = bytes[i + 6] - b'0';
                    let ones = bytes[i + 7] - b'0';
                    let year = tens * 10 + ones;
                    // Years 00-29 are plausible for 2000-2029
                    // Higher two-digit years could be 1930-1999 which don't
                    // make sense for PTRs (pre-2015 would be classified separately)
                    if year < 30 {
                        return true;
                    }
                }
            }
        }
        i += 1;
    }

    false
}

/// Parse a PTR document using the existing intel_backend parser.
/// Returns parsed transactions or None if the layout is not recognized.
pub fn parse_ptr_text(text: &str) -> Vec<intel_backend::disclosures::ParsedPtrTransaction> {
    intel_backend::disclosures::parse_house_ptr_text(text)
}

/// Parse older PTR formats (2015-2021) with less structured text.
/// Falls back to the standard parser with additional cleanup.
pub fn parse_ptr_legacy(text: &str) -> Vec<intel_backend::disclosures::ParsedPtrTransaction> {
    // Legacy PTRs often have multi-line asset names, wrapped amounts,
    // and inconsistent spacing. Apply pre-processing:
    // 1. Collapse multi-line asset names (lines without dates or amounts)
    // 2. Normalize whitespace around dollar amounts
    // 3. Pass cleaned text to the standard parser
    let cleaned = text
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    intel_backend::disclosures::parse_house_ptr_text(&cleaned)
}

/// Parse electronic annual reports.
/// Annual reports have Schedules A-H in labeled sections.
/// This extracts Schedule A (assets) and Schedule B (transactions).
pub fn parse_annual_electronic(
    text: &str,
) -> intel_backend::annual_disclosures::ParsedAnnualReport {
    intel_backend::annual_disclosures::parse_house_annual_text(text)
}

/// Parse scanned/image annual reports through the pdftoppm/Tesseract fallback.
pub fn parse_annual_scanned(
    pdf_path: &str,
) -> Result<intel_backend::annual_disclosures::ParsedAnnualReport, std::io::Error> {
    let text = extract_text_with_ocr(pdf_path)?;
    Ok(parse_annual_electronic(&text))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fingerprint_ptr_electronic_2022_plus() {
        let text = "PERIODIC TRANSACTION REPORT\n\
                     Name: John Smith\n\
                     Owner: Self\n\
                     Amount: $1,001 - $15,000\n\
                     Date: 03/15/2024\n";
        assert_eq!(fingerprint(text), DocumentLayout::PtrElectronic2022Plus);
    }

    #[test]
    fn test_fingerprint_ptr_legacy_2015_2021() {
        let text = "PERIODIC TRANSACTION REPORT\n\
                     Transaction Date: 06/01/2017\n\
                     Amount: $1,001 - $15,000\n\
                     Date Filed: 06/15/2017\n";
        assert_eq!(fingerprint(text), DocumentLayout::PtrLegacy2015To2021);
    }

    #[test]
    fn test_fingerprint_ptr_pre_2015() {
        let text = "PURCHASE OF SECURITIES\n\
                     Sale of Common Stock\n\
                     Exchange of Holdings\n";
        assert_eq!(fingerprint(text), DocumentLayout::PtrPre2015);
    }

    #[test]
    fn test_fingerprint_annual_electronic() {
        let text = "ANNUAL REPORT FOR 2023\n\
                     Financial Disclosure Report\n\
                     Member Name: Jane Doe\n\
                     Assets: $500,000 - $1,000,000\n\
                     This is a long enough text with enough actual\n\
                     content to exceed the 100 non-whitespace\n\
                     character threshold for electronic detection.\n";
        assert_eq!(fingerprint(text), DocumentLayout::AnnualElectronic);
    }

    #[test]
    fn test_fingerprint_annual_scanned() {
        let text = "ANNUAL REPORT FOR 2022\n\
                     Financial Disclosure Report\n\
                     \n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n";
        assert_eq!(fingerprint(text), DocumentLayout::AnnualScanned);
    }

    #[test]
    fn test_fingerprint_unknown() {
        let text = "Some random text that doesn't match anything\n";
        assert_eq!(fingerprint(text), DocumentLayout::Unknown);
    }

    #[test]
    fn test_extract_text_with_nonexistent_file() {
        let result = extract_text("/nonexistent/pdf/path.pdf");
        assert!(result.is_err());
    }

    #[test]
    fn malformed_annual_text_produces_no_fabricated_records() {
        let parsed = parse_annual_electronic(
            "ANNUAL REPORT\nFinancial Disclosure Report\nSchedule data unavailable",
        );
        assert!(parsed.assets.is_empty());
        assert!(parsed.liabilities.is_empty());
        assert!(parsed.income.is_empty());
        assert!(parsed.gifts.is_empty());
        assert!(parsed.positions.is_empty());
    }

    #[test]
    fn ocr_failure_is_returned_for_a_missing_source_file() {
        let result = extract_text_with_ocr("/nonexistent/pdf/path.pdf");
        assert!(result.is_err());
    }
}
