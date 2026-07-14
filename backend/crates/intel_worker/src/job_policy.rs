#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RetryDisposition {
    Pending,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DownloadDisposition {
    Success,
    NotModified,
    RateLimited,
    Failed,
}

/// Whether a batch of disk-consuming jobs (downloads, OCR/PDF processing)
/// should proceed against the storage volume or be parked until space frees
/// up. Parking never fails a job — it simply declines to claim it this tick.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiskSpaceDisposition {
    Proceed,
    Parked,
}

/// Default free-space floor, in GiB, below which disk-consuming jobs park
/// rather than claim. Configurable via INTEL_WORKER_MIN_FREE_GIB.
pub const DEFAULT_MIN_FREE_GIB: u64 = 50;

pub fn disk_space_disposition(free_bytes: u64, min_free_gib: u64) -> DiskSpaceDisposition {
    let min_free_bytes = min_free_gib.saturating_mul(1024 * 1024 * 1024);
    if free_bytes < min_free_bytes {
        DiskSpaceDisposition::Parked
    } else {
        DiskSpaceDisposition::Proceed
    }
}

pub fn min_free_gib_from_env(value: Option<&str>) -> u64 {
    value
        .and_then(|raw| raw.trim().parse::<u64>().ok())
        .filter(|parsed| *parsed > 0)
        .unwrap_or(DEFAULT_MIN_FREE_GIB)
}

pub fn retry_disposition(attempts: i32, max_attempts: i32) -> RetryDisposition {
    if attempts.saturating_add(1) >= max_attempts {
        RetryDisposition::Failed
    } else {
        RetryDisposition::Pending
    }
}

pub fn download_disposition(status: u16) -> DownloadDisposition {
    match status {
        200..=299 => DownloadDisposition::Success,
        304 => DownloadDisposition::NotModified,
        429 | 503 => DownloadDisposition::RateLimited,
        _ => DownloadDisposition::Failed,
    }
}

pub fn senate_refresh_enabled(terms_acceptance: Option<&str>) -> bool {
    terms_acceptance == Some("1")
}

pub fn lda_refresh_years(current_year: i32, configured: Option<&str>) -> Vec<i32> {
    let mut years = configured
        .into_iter()
        .flat_map(|value| value.split(','))
        .filter_map(|value| value.trim().parse::<i32>().ok())
        .filter(|year| (2012..=current_year).contains(year))
        .collect::<Vec<_>>();
    if years.is_empty() {
        years = vec![
            current_year.saturating_sub(1).max(2012),
            current_year.max(2012),
        ];
    }
    years.sort_unstable();
    years.dedup();
    if years.len() > 4 {
        years.drain(..years.len() - 4);
    }
    years
}

pub fn bounded_lda_page_size(value: Option<&str>) -> u32 {
    value
        .and_then(|raw| raw.parse().ok())
        .unwrap_or(100)
        .clamp(10, 100)
}

pub fn bounded_lda_page_limit(value: Option<&str>) -> u32 {
    value
        .and_then(|raw| raw.parse().ok())
        .unwrap_or(50)
        .clamp(1, 100)
}

pub fn lda_job_identity(year: i32, page: u32, page_size: u32) -> String {
    format!("filings:{year}:page:{page}:size:{page_size}")
}

pub fn parse_lda_job_identity(value: &str) -> Option<(u32, u32)> {
    let parts = value.split(':').collect::<Vec<_>>();
    match parts.as_slice() {
        ["filings", _, "page", page, "size", page_size] => {
            Some((page.parse().ok()?, page_size.parse().ok()?))
        }
        _ => None,
    }
}

pub fn retry_delay_seconds(attempts: i32, fixed_delay_seconds: Option<i64>, jitter: u64) -> i64 {
    fixed_delay_seconds.unwrap_or_else(|| {
        let exponent = u32::try_from(attempts.clamp(0, 10)).unwrap_or(0);
        i64::try_from(2u64.pow(exponent).saturating_add(jitter.min(29))).unwrap_or(60)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interruption_requeues_until_the_attempt_budget_is_exhausted() {
        assert_eq!(retry_disposition(0, 5), RetryDisposition::Pending);
        assert_eq!(retry_disposition(3, 5), RetryDisposition::Pending);
        assert_eq!(retry_disposition(4, 5), RetryDisposition::Failed);
        assert_eq!(retry_disposition(i32::MAX, 5), RetryDisposition::Failed);
    }

    #[test]
    fn rate_limits_are_retryable_but_other_http_failures_are_not_misclassified() {
        assert_eq!(download_disposition(429), DownloadDisposition::RateLimited);
        assert_eq!(download_disposition(503), DownloadDisposition::RateLimited);
        assert_eq!(download_disposition(404), DownloadDisposition::Failed);
        assert_eq!(download_disposition(200), DownloadDisposition::Success);
        assert_eq!(download_disposition(304), DownloadDisposition::NotModified);
    }

    #[test]
    fn senate_refresh_requires_exact_operator_consent() {
        assert!(!senate_refresh_enabled(None));
        assert!(!senate_refresh_enabled(Some("")));
        assert!(!senate_refresh_enabled(Some("true")));
        assert!(!senate_refresh_enabled(Some("0")));
        assert!(senate_refresh_enabled(Some("1")));
    }

    #[test]
    fn lda_refresh_scope_is_recent_deduplicated_and_bounded() {
        assert_eq!(lda_refresh_years(2026, None), vec![2025, 2026]);
        assert_eq!(
            lda_refresh_years(2026, Some("2026, 2011,2024,2024,2023,2022,2021")),
            vec![2022, 2023, 2024, 2026]
        );
        assert_eq!(lda_refresh_years(2012, Some("invalid")), vec![2012]);
        assert_eq!(bounded_lda_page_size(None), 100);
        assert_eq!(bounded_lda_page_size(Some("500")), 100);
        assert_eq!(bounded_lda_page_limit(Some("0")), 1);
        assert_eq!(bounded_lda_page_limit(Some("500")), 100);
        let identity = lda_job_identity(2026, 51, 25);
        assert_eq!(identity, "filings:2026:page:51:size:25");
        assert_eq!(parse_lda_job_identity(&identity), Some((51, 25)));
        assert_eq!(parse_lda_job_identity("filings:2026:page:51"), None);
    }

    #[test]
    fn parser_failures_use_the_fixed_cooldown_and_network_retries_are_bounded() {
        assert_eq!(retry_delay_seconds(0, Some(3_600), 29), 3_600);
        assert_eq!(retry_delay_seconds(0, None, 0), 1);
        assert_eq!(retry_delay_seconds(3, None, 29), 37);
        assert_eq!(retry_delay_seconds(100, None, 29), 1_053);
    }

    #[test]
    fn low_disk_parks_jobs_at_the_configured_gib_floor() {
        let one_gib = 1024u64 * 1024 * 1024;
        assert_eq!(
            disk_space_disposition(49 * one_gib, 50),
            DiskSpaceDisposition::Parked
        );
        assert_eq!(
            disk_space_disposition(50 * one_gib, 50),
            DiskSpaceDisposition::Proceed
        );
        assert_eq!(
            disk_space_disposition(51 * one_gib, 50),
            DiskSpaceDisposition::Proceed
        );
        assert_eq!(disk_space_disposition(0, 0), DiskSpaceDisposition::Proceed);
    }

    #[test]
    fn disk_floor_env_parsing_defaults_and_rejects_nonsense() {
        assert_eq!(min_free_gib_from_env(None), DEFAULT_MIN_FREE_GIB);
        assert_eq!(min_free_gib_from_env(Some("")), DEFAULT_MIN_FREE_GIB);
        assert_eq!(
            min_free_gib_from_env(Some("not-a-number")),
            DEFAULT_MIN_FREE_GIB
        );
        assert_eq!(min_free_gib_from_env(Some("0")), DEFAULT_MIN_FREE_GIB);
        assert_eq!(min_free_gib_from_env(Some("-5")), DEFAULT_MIN_FREE_GIB);
        assert_eq!(min_free_gib_from_env(Some("120")), 120);
        assert_eq!(min_free_gib_from_env(Some("  75  ")), 75);
    }
}
