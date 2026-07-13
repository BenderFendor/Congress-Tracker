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
    fn parser_failures_use_the_fixed_cooldown_and_network_retries_are_bounded() {
        assert_eq!(retry_delay_seconds(0, Some(3_600), 29), 3_600);
        assert_eq!(retry_delay_seconds(0, None, 0), 1);
        assert_eq!(retry_delay_seconds(3, None, 29), 37);
        assert_eq!(retry_delay_seconds(100, None, 29), 1_053);
    }
}
