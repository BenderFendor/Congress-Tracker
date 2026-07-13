use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const MIN_TEXT_BYTES: usize = 100;

#[derive(Debug, Clone, Copy)]
struct ProcessBudget {
    timeout: Duration,
    max_output_bytes: u64,
    max_address_space_bytes: u64,
    max_cpu_seconds: u64,
}

#[derive(Debug, Clone, Copy)]
struct ParserBudget {
    document_timeout: Duration,
    max_pages: usize,
    max_pdf_bytes: u64,
    max_scratch_bytes: u64,
    text: ProcessBudget,
    render: ProcessBudget,
    ocr: ProcessBudget,
}

impl ParserBudget {
    fn from_env() -> Self {
        let profile =
            std::env::var("WORKER_RESOURCE_PROFILE").unwrap_or_else(|_| "interactive".to_string());
        let max_address_space_bytes = match profile.as_str() {
            "pi" => 384 * 1024 * 1024,
            "burst" => 2 * 1024 * 1024 * 1024,
            _ => 768 * 1024 * 1024,
        };
        let max_pages = env_bound("PARSER_MAX_PAGES", 100, 1, 500) as usize;
        let max_scratch_bytes = env_bound(
            "PARSER_MAX_SCRATCH_BYTES",
            512 * 1024 * 1024,
            1,
            4 * 1024 * 1024 * 1024,
        );
        Self {
            document_timeout: Duration::from_secs(env_bound(
                "PARSER_DOCUMENT_TIMEOUT_SECONDS",
                600,
                30,
                3_600,
            )),
            max_pages,
            max_pdf_bytes: env_bound(
                "PARSER_MAX_PDF_BYTES",
                100 * 1024 * 1024,
                1,
                512 * 1024 * 1024,
            ),
            max_scratch_bytes,
            text: ProcessBudget {
                timeout: Duration::from_secs(env_bound("PDFTOTEXT_TIMEOUT_SECONDS", 60, 1, 600)),
                max_output_bytes: env_bound(
                    "PARSER_MAX_TEXT_BYTES",
                    16 * 1024 * 1024,
                    1,
                    128 * 1024 * 1024,
                ),
                max_address_space_bytes,
                max_cpu_seconds: 60,
            },
            render: ProcessBudget {
                timeout: Duration::from_secs(env_bound("PDF_RENDER_TIMEOUT_SECONDS", 120, 1, 600)),
                // RLIMIT_FSIZE applies to every rendered page. Dividing the
                // total scratch budget makes page_count * file_cap bounded
                // throughout rendering, before the aggregate post-check.
                max_output_bytes: render_file_cap(max_scratch_bytes, max_pages),
                max_address_space_bytes,
                max_cpu_seconds: 120,
            },
            ocr: ProcessBudget {
                timeout: Duration::from_secs(env_bound("OCR_PAGE_TIMEOUT_SECONDS", 20, 1, 120)),
                max_output_bytes: env_bound(
                    "OCR_PAGE_MAX_TEXT_BYTES",
                    2 * 1024 * 1024,
                    1,
                    16 * 1024 * 1024,
                ),
                max_address_space_bytes,
                max_cpu_seconds: 20,
            },
        }
    }
}

fn render_file_cap(max_scratch_bytes: u64, max_pages: usize) -> u64 {
    (max_scratch_bytes / max_pages.max(1) as u64).max(1)
}

fn interactive_host_is_busy() -> bool {
    if std::env::var("WORKER_RESOURCE_PROFILE").as_deref() != Ok("interactive")
        && std::env::var("WORKER_RESOURCE_PROFILE").is_ok()
    {
        return false;
    }
    let cores = std::thread::available_parallelism().map_or(1, usize::from) as f64;
    let load = std::fs::read_to_string("/proc/loadavg")
        .ok()
        .and_then(|value| value.split_whitespace().next()?.parse::<f64>().ok())
        .unwrap_or(0.0);
    let available_kib = std::fs::read_to_string("/proc/meminfo")
        .ok()
        .and_then(|value| {
            value.lines().find_map(|line| {
                line.strip_prefix("MemAvailable:")?
                    .split_whitespace()
                    .next()?
                    .parse::<u64>()
                    .ok()
            })
        })
        .unwrap_or(u64::MAX);
    interactive_pressure_exceeded(load, cores, available_kib)
}

fn interactive_pressure_exceeded(load: f64, cores: f64, available_kib: u64) -> bool {
    load >= (cores - 2.0).max(1.0) || available_kib < 2 * 1024 * 1024
}

fn env_bound(name: &str, default: u64, min: u64, max: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
        .clamp(min, max)
}

#[derive(Debug)]
struct BoundedOutput {
    status: ExitStatus,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

struct CleanupDir(PathBuf);

impl Drop for CleanupDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn remaining_process_budget(
    budget: ProcessBudget,
    started: Instant,
    document_timeout: Duration,
) -> Result<ProcessBudget, std::io::Error> {
    let remaining = document_timeout
        .checked_sub(started.elapsed())
        .ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::TimedOut,
                "document extraction budget exceeded",
            )
        })?;
    Ok(ProcessBudget {
        timeout: budget.timeout.min(remaining),
        ..budget
    })
}

fn run_bounded(
    program: &str,
    args: &[&str],
    budget: ProcessBudget,
) -> Result<BoundedOutput, std::io::Error> {
    let directory =
        std::env::temp_dir().join(format!("congress-tracker-process-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&directory)?;
    let _cleanup = CleanupDir(directory.clone());
    let stdout_path = directory.join("stdout");
    let stderr_path = directory.join("stderr");
    let stdout = File::create(&stdout_path)?;
    let stderr = File::create(&stderr_path)?;
    let mut command = Command::new(program);
    command
        .args(args)
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));
    unsafe {
        command.pre_exec(move || {
            let address = libc::rlimit {
                rlim_cur: budget.max_address_space_bytes,
                rlim_max: budget.max_address_space_bytes,
            };
            let file = libc::rlimit {
                // Permit one byte past the logical cap so the parent can
                // distinguish exact-cap output from kernel truncation.
                rlim_cur: budget.max_output_bytes.saturating_add(1),
                rlim_max: budget.max_output_bytes.saturating_add(1),
            };
            let cpu = libc::rlimit {
                rlim_cur: budget.max_cpu_seconds,
                rlim_max: budget.max_cpu_seconds + 1,
            };
            if libc::setrlimit(libc::RLIMIT_AS, &address) != 0
                || libc::setrlimit(libc::RLIMIT_FSIZE, &file) != 0
                || libc::setrlimit(libc::RLIMIT_CPU, &cpu) != 0
                || libc::setpgid(0, 0) != 0
            {
                return Err(std::io::Error::last_os_error());
            }
            libc::nice(10);
            Ok(())
        });
    }
    let mut child = command.spawn()?;
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if started.elapsed() >= budget.timeout {
            unsafe {
                libc::kill(-(child.id() as i32), libc::SIGKILL);
            }
            let _ = child.wait();
            return Err(std::io::Error::new(
                std::io::ErrorKind::TimedOut,
                format!("{program} exceeded {}s", budget.timeout.as_secs()),
            ));
        }
        thread::sleep(Duration::from_millis(25));
    };
    let stdout = read_bounded(&stdout_path, budget.max_output_bytes)?;
    let stderr = read_bounded(&stderr_path, budget.max_output_bytes.min(1024 * 1024))?;
    Ok(BoundedOutput {
        status,
        stdout,
        stderr,
    })
}

fn read_bounded(path: &Path, limit: u64) -> Result<Vec<u8>, std::io::Error> {
    let mut file = File::open(path)?;
    let length = file.seek(SeekFrom::End(0))?;
    if length > limit {
        return Err(std::io::Error::other(format!(
            "subprocess output exceeded {limit} bytes"
        )));
    }
    file.seek(SeekFrom::Start(0))?;
    let mut bytes = Vec::with_capacity(length as usize);
    file.read_to_end(&mut bytes)?;
    Ok(bytes)
}

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
    extract_text_with_budget(pdf_path, ParserBudget::from_env())
}

fn extract_text_with_budget(
    pdf_path: &str,
    budget: ParserBudget,
) -> Result<String, std::io::Error> {
    let size = std::fs::metadata(pdf_path)?.len();
    if size > budget.max_pdf_bytes {
        return Err(std::io::Error::other(format!(
            "PDF exceeds {} byte input limit",
            budget.max_pdf_bytes
        )));
    }
    let output = run_bounded("pdftotext", &["-layout", pdf_path, "-"], budget.text)?;
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
    let budget = ParserBudget::from_env();
    let document_started = Instant::now();
    let text = extract_text_with_budget(pdf_path, budget)?;
    if text
        .chars()
        .filter(|character| !character.is_whitespace())
        .count()
        >= MIN_TEXT_BYTES
    {
        return Ok(text);
    }
    if interactive_host_is_busy() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::WouldBlock,
            "interactive resource pressure defers new OCR work",
        ));
    }
    let directory =
        std::env::temp_dir().join(format!("congress-tracker-ocr-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&directory)?;
    let _cleanup = CleanupDir(directory.clone());
    let prefix = directory.join("page");
    let page_limit = budget.max_pages.to_string();
    let prefix_string = prefix.to_string_lossy().into_owned();
    let render = run_bounded(
        "pdftoppm",
        &[
            "-png",
            "-r",
            "200",
            "-f",
            "1",
            "-l",
            &page_limit,
            pdf_path,
            &prefix_string,
        ],
        remaining_process_budget(budget.render, document_started, budget.document_timeout)?,
    )?;
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
    if pages.len() > budget.max_pages || directory_size(&directory)? > budget.max_scratch_bytes {
        let _ = std::fs::remove_dir_all(&directory);
        return Err(std::io::Error::other("OCR scratch/page budget exceeded"));
    }
    let mut ocr = String::new();
    for page in pages {
        if document_started.elapsed() >= budget.document_timeout {
            let _ = std::fs::remove_dir_all(&directory);
            return Err(std::io::Error::new(
                std::io::ErrorKind::TimedOut,
                "document OCR budget exceeded",
            ));
        }
        let page_string = page.to_string_lossy().into_owned();
        let output = run_bounded(
            "tesseract",
            &[&page_string, "stdout", "--psm", "6"],
            remaining_process_budget(budget.ocr, document_started, budget.document_timeout)?,
        )?;
        if output.status.success() {
            if ocr.len().saturating_add(output.stdout.len()) > budget.text.max_output_bytes as usize
            {
                let _ = std::fs::remove_dir_all(&directory);
                return Err(std::io::Error::other("OCR document text budget exceeded"));
            }
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
        >= MIN_TEXT_BYTES
    {
        Ok(ocr)
    } else {
        Ok(text)
    }
}

fn directory_size(path: &PathBuf) -> Result<u64, std::io::Error> {
    std::fs::read_dir(path)?.try_fold(0_u64, |total, entry| {
        Ok(total.saturating_add(entry?.metadata()?.len()))
    })
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
    use std::time::Duration;

    use super::*;
    use super::{interactive_pressure_exceeded, render_file_cap, run_bounded, ProcessBudget};

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

    fn test_process_budget(timeout: Duration, max_output_bytes: u64) -> ProcessBudget {
        ProcessBudget {
            timeout,
            max_output_bytes,
            max_address_space_bytes: 256 * 1024 * 1024,
            max_cpu_seconds: 2,
        }
    }

    #[test]
    fn bounded_process_kills_a_timed_out_process_group() {
        let result = run_bounded(
            "sh",
            &["-c", "sleep 5"],
            test_process_budget(Duration::from_millis(100), 1024),
        );
        let error = result.expect_err("sleep must be killed by the wall-time budget");
        assert_eq!(error.kind(), std::io::ErrorKind::TimedOut);
    }

    #[test]
    fn bounded_process_rejects_oversized_output() {
        let result = run_bounded(
            "sh",
            &["-c", "printf 123456789"],
            test_process_budget(Duration::from_secs(2), 8),
        );
        assert!(result.is_err(), "output larger than the cap must fail");
    }

    #[test]
    fn interactive_profile_reserves_cpu_and_memory_headroom() {
        assert!(interactive_pressure_exceeded(10.0, 12.0, 8 * 1024 * 1024));
        assert!(interactive_pressure_exceeded(1.0, 12.0, 1024 * 1024));
        assert!(!interactive_pressure_exceeded(4.0, 12.0, 8 * 1024 * 1024));
    }

    #[test]
    fn render_file_limits_cannot_exceed_total_scratch_budget() {
        let pages = 100;
        let scratch = 512 * 1024 * 1024;
        assert!(render_file_cap(scratch, pages) * pages as u64 <= scratch);
    }
}
