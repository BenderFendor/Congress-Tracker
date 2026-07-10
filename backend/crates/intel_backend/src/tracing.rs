use std::fs;
use std::io;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

/// Initialize the global tracing subscriber.
///
/// Logs are always written to `./log/intel_backend.log` as daily-rotating JSON.
/// Console output (compact text to stderr) is on by default; set `LOG_CONSOLE=off` to disable.
///
/// Control via environment variables:
/// - `RUST_LOG` — per-module filter (default: `info,intel_backend=debug,tower_http=info,sqlx=warn`)
/// - `LOG_DIR` — directory for log files (default: `./log`)
/// - `LOG_CONSOLE=off` — disable stderr output
pub fn init() {
    let log_dir = std::env::var("LOG_DIR").unwrap_or_else(|_| "./log".to_string());
    fs::create_dir_all(&log_dir).expect("failed to create log directory");

    // Daily-rotating, non-blocking file appender
    let file_appender = tracing_appender::rolling::daily(&log_dir, "intel_backend.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    std::mem::forget(_guard);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,intel_backend=debug,tower_http=info,sqlx=warn"));

    let file_layer = tracing_subscriber::fmt::layer()
        .with_target(true)
        .with_thread_ids(false)
        .with_thread_names(false)
        .json()
        .flatten_event(true)
        .with_writer(non_blocking);

    let console_off = std::env::var("LOG_CONSOLE").unwrap_or_default() == "off";

    // Use a closure-based writer for console — returns stderr or sink
    let console_layer = tracing_subscriber::fmt::layer()
        .with_target(true)
        .with_thread_ids(false)
        .with_thread_names(false)
        .with_ansi(!console_off)
        .compact()
        .with_writer(move || -> Box<dyn io::Write + Send + Sync> {
            if console_off {
                Box::new(io::sink())
            } else {
                Box::new(io::stderr())
            }
        });

    tracing_subscriber::registry()
        .with(env_filter)
        .with(file_layer)
        .with(console_layer)
        .init();

    tracing::info!(log_dir = %log_dir, "tracing subscriber initialized");
}
