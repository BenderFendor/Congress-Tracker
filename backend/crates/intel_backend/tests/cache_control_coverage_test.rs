//! FA-29: proves every public GET route on the intel_backend API emits an
//! explicit, non-empty `Cache-Control` header (ADR 0003).
//!
//! `cache_control_middleware` in `src/routes/mod.rs` sets the header on
//! every response, keyed off route-class max-age buckets. This test does
//! not re-derive that classification — it enumerates the routes actually
//! registered in `routes::build_router` and proves the header shows up on
//! the wire for each one, including on a 404 (unknown entity), so a route
//! whose handler bypasses the outer middleware layer cannot slip through.
//!
//! The proxy hit-ratio half of the M7 proof (reverse-proxy cache behavior)
//! is deliberately out of scope here — it depends on infrastructure that
//! does not exist yet.
//!
//! ROUTES below is a literal mirror of every `.route(...)` registration in
//! `src/routes/mod.rs`, each rendered with a syntactically valid but
//! nonexistent path-param value. `route_count_matches_router_source` reads
//! that file's own source at test time and fails if the number of
//! `.route(` registrations there no longer matches `ROUTES.len()` — so a
//! newly added route cannot silently skip cache-control coverage; the
//! author must add it to this list (and re-run this test) before it will
//! pass.

use reqwest::StatusCode;
use std::net::TcpListener;
use std::process::{Child, Command};
use std::time::Duration;
use tokio::time::{sleep, timeout};

/// Every public GET route registered in `routes::build_router`, as a
/// concrete request path. Path-param placeholders are intentionally
/// unknown/fake values — the point is to prove the header is present
/// whether the handler hits, misses, or 404s, not to prove the handlers
/// return real data (that's `full_api_contract_test.rs`'s job).
const ROUTES: &[&str] = &[
    "/api/health",
    "/api/system/disclosure-coverage",
    "/api/financial-snapshots",
    "/api/senate-disclosures",
    "/api/system/worker-health",
    "/api/home/summary",
    "/api/sources/status",
    "/api/sources/coverage",
    "/api/legislators",
    "/api/legislators/Z000000",
    "/api/members/Z000000/profile",
    "/api/members",
    "/api/members/Z000000/votes",
    "/api/members/Z000000/legislation",
    "/api/members/Z000000/disclosures",
    "/api/bills",
    "/api/bills/hr1-118",
    "/api/bills/118/hr/1/intel",
    "/api/bills/118/hr/1/amendments",
    "/api/members/Z000000/funding",
    "/api/influence/networks",
    "/api/influence/networks/does-not-exist",
    "/api/influence/networks/does-not-exist/financials",
    "/api/committees",
    "/api/committees/ZZZZZ99",
    "/api/chambers/house/dashboard",
    "/api/intel/trades",
    "/api/intel/trades/ZZZZZ",
    "/api/stocks/transactions",
    "/api/members/Z000000/trades",
    "/api/intel/portfolio/summary",
    "/api/intel/portfolio/members",
    "/api/intel/portfolio/sectors",
    "/api/intel/portfolio/pulse",
    "/api/portfolios",
    "/api/search?q=test",
    "/api/relationships",
    "/api/organizations/999999",
    "/api/lobbying/filings",
    "/api/lobbying/filings/999999",
    "/api/lobbying/clients",
    "/api/lobbying/clients/999999",
    "/api/lobbying/registrants",
    "/api/lobbying/registrants/999999",
    "/api/lobbying/lobbyists",
    "/api/lobbying/lobbyists/999999",
    "/api/visualizations/campaign-finance",
    "/api/intel/fec/candidates",
    "/api/intel/fec/committees",
    "/api/fec/receipts",
    "/api/fec/disbursements",
    "/api/intel/fec/receipts",
    "/api/elections/candidates",
    "/api/elections/candidates/Z000000",
];

// ── Helpers (mirrors full_api_contract_test.rs) ────────────────────────────

fn get_available_port() -> u16 {
    (8000..9000)
        .find(|port| TcpListener::bind(("127.0.0.1", *port)).is_ok())
        .expect("No free ports available in range 8000-9000")
}

async fn wait_for_health(base_url: &str) -> reqwest::Client {
    let builder = reqwest::Client::builder().timeout(Duration::from_secs(3));
    let client = builder.build().expect("Failed to build HTTP client");
    let check = || async {
        loop {
            if let Ok(response) = client.get(format!("{base_url}/api/health")).send().await {
                if response.status() == StatusCode::OK {
                    return;
                }
            }
            sleep(Duration::from_millis(250)).await;
        }
    };
    timeout(Duration::from_secs(30), check())
        .await
        .expect("intel_backend did not become healthy");
    client
}

fn spawn_intel_backend(port: u16) -> Option<Child> {
    let database_url = match std::env::var("DATABASE_URL") {
        Ok(value) if !value.is_empty() => value,
        _ => return None,
    };
    let binary = find_binary();
    Some(
        Command::new(binary)
            .env("DATABASE_URL", database_url)
            .env("PORT", port.to_string())
            .env("RUST_LOG", "off")
            .spawn()
            .expect("Failed to start intel_backend"),
    )
}

fn find_binary() -> String {
    let workspace_binary =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/debug/intel_backend");
    if workspace_binary.is_file() {
        return workspace_binary.to_string_lossy().into_owned();
    }
    let candidates = [
        "backend/target/debug/intel_backend",
        "target/debug/intel_backend",
        "backend/target/release/intel_backend",
        "target/release/intel_backend",
    ];
    for c in &candidates {
        if std::path::Path::new(c).exists() {
            return c.to_string();
        }
    }
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let p = format!("{manifest_dir}/target/debug/intel_backend");
        if std::path::Path::new(&p).exists() {
            return p;
        }
    }
    "target/debug/intel_backend".to_string()
}

async fn setup() -> Option<(reqwest::Client, String, Child)> {
    let port = get_available_port();
    let child = spawn_intel_backend(port)?;
    let base_url = format!("http://127.0.0.1:{port}");
    let client = wait_for_health(&base_url).await;
    Some((client, base_url, child))
}

async fn kill_server(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

// ── Drift guard ─────────────────────────────────────────────────────────────

/// Fails when `src/routes/mod.rs` gains or loses a `.route(...)` registration
/// without `ROUTES` above being updated to match. This is the fallback for
/// not being able to enumerate axum 0.7's `Router` at runtime: the router
/// builder source is the single source of truth, and this test counts its
/// own literal list against it.
#[test]
fn route_count_matches_router_source() {
    let source = include_str!("../src/routes/mod.rs");
    let registered_route_count = source.matches(".route(").count();
    assert_eq!(
        registered_route_count,
        ROUTES.len(),
        "src/routes/mod.rs has {registered_route_count} `.route(...)` registrations \
         but this test's ROUTES list has {}. Add/remove the new route in ROUTES \
         above (with a syntactically valid placeholder path) so cache-control \
         coverage stays exhaustive.",
        ROUTES.len()
    );
}

// ── Main coverage test ───────────────────────────────────────────────────────

#[tokio::test]
async fn all_public_get_routes_emit_cache_control() {
    let Some((client, base_url, mut child)) = setup().await else {
        eprintln!("Skipping: DATABASE_URL is not set");
        return;
    };

    let mut missing = Vec::new();
    let mut empty = Vec::new();

    for route in ROUTES {
        let resp = client
            .get(format!("{base_url}{route}"))
            .send()
            .await
            .unwrap_or_else(|e| panic!("{route}: request failed: {e}"));

        let status = resp.status();
        match resp.headers().get(reqwest::header::CACHE_CONTROL) {
            None => missing.push(format!("{route} (status {status})")),
            Some(value) => {
                let is_empty = value.to_str().map(|s| s.trim().is_empty()).unwrap_or(true);
                if is_empty {
                    empty.push(format!("{route} (status {status})"));
                } else {
                    println!("  ok  {status} {route} -> {value:?}");
                }
            }
        }
    }

    kill_server(&mut child).await;

    assert!(
        missing.is_empty(),
        "routes missing Cache-Control header entirely:\n  {}",
        missing.join("\n  ")
    );
    assert!(
        empty.is_empty(),
        "routes with an empty/blank Cache-Control header:\n  {}",
        empty.join("\n  ")
    );

    println!(
        "\n✓ all {} enumerated public GET routes emit a non-empty Cache-Control header",
        ROUTES.len()
    );
}
