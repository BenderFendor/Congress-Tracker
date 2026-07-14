use reqwest::StatusCode;
use serde_json::Value;
use std::net::TcpListener;
use std::process::{Child, Command};
use std::time::Duration;
use tokio::time::{sleep, timeout};

const TEST_MEMBER: &str = "A000370"; // Alma Adams — most complete data
const UNKNOWN_MEMBER: &str = "ZZ99999";
const UNKNOWN_BILL: &str = "99999";
const UNKNOWN_SLUG: &str = "this-network-does-not-exist";
const UNKNOWN_COMMITTEE: &str = "ZZZZZ99";
const UNKNOWN_ORG: &str = "999999";
const UNKNOWN_LOBBYING: &str = "999999";
const UNKNOWN_TICKER: &str = "ZZZZZ";

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    // Try the binary in the cargo target dir first (during `cargo test` the binary
    // is built in test profile, so fall back to test target if dev doesn't exist).
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
    // Try multiple relative and absolute patterns to handle different CWD setups.
    let candidates = [
        // Workspace root: ~/classwork/congress-tracker/
        "backend/target/debug/intel_backend",
        // Member root: ~/classwork/congress-tracker/backend/
        "target/debug/intel_backend",
        // Release profile
        "backend/target/release/intel_backend",
        "target/release/intel_backend",
        // Target test profile run from workspace root
        "backend/target/release/intel_backend",
    ];
    for c in &candidates {
        if std::path::Path::new(c).exists() {
            return c.to_string();
        }
    }
    // Also try via CARGO_MANIFEST_DIR if set
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let p = format!("{manifest_dir}/target/debug/intel_backend");
        if std::path::Path::new(&p).exists() {
            return p;
        }
    }
    // Last resort
    "target/debug/intel_backend".to_string()
}

async fn setup() -> Option<(reqwest::Client, String, Child)> {
    let port = get_available_port();
    let child = spawn_intel_backend(port)?;
    let base_url = format!("http://127.0.0.1:{port}");
    let client = wait_for_health(&base_url).await;
    Some((client, base_url, child))
}

fn print_section(label: &str) {
    println!("\n─── {label} ───");
}

fn summarize_json(label: &str, value: &Value) {
    let summary = match value {
        Value::Object(m) => {
            let fields: Vec<String> = m
                .iter()
                .map(|(k, v)| match v {
                    Value::String(s) if s.len() > 60 => format!("{k}: \"{}…\"", &s[..57]),
                    Value::Array(a) => format!("{k}: [{} items]", a.len()),
                    Value::Object(_) => format!("{k}: {{…}}"),
                    other => format!("{k}: {other}"),
                })
                .collect();
            fields.join(", ")
        }
        Value::Array(a) => format!("[{} items]", a.len()),
        other => format!("{other}"),
    };
    println!("  [{label}] {summary}");
}

async fn kill_server(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

/// Assert a response is a well-formed JSON error with status/message fields.
fn assert_json_error(status: StatusCode, body: &Value) {
    assert!(
        status.is_client_error() || status.is_server_error(),
        "expected error status, got {status}"
    );
    let has_status = body.get("status").or_else(|| body.get("error")).is_some();
    let has_message = body.get("message").or_else(|| body.get("msg")).is_some();
    assert!(
        has_status && has_message,
        "error response should have status+message fields, got: {body}"
    );
    println!("  ⚠ expected {status} — well-formed error response");
}

/// Get and print response summary for a successful endpoint call.
async fn check_endpoint(
    client: &reqwest::Client,
    base_url: &str,
    method: &str,
    label: &str,
) -> (StatusCode, Value) {
    let resp = client
        .get(format!("{base_url}{method}"))
        .send()
        .await
        .unwrap_or_else(|_| panic!("{label}: request failed"));

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .unwrap_or_else(|_| panic!("{label}: response was not JSON"));

    println!("  {method}");
    if status == StatusCode::OK {
        summarize_json(label, &body);
        println!("  ✓ {status}");
    } else {
        println!("  ⚠ {status}");
    }
    (status, body)
}

// ── Main Test ────────────────────────────────────────────────────────────────
// Single comprehensive test covering ALL endpoints. Runs sequentially in one
// server spawn to avoid 37+ separate boot cycles.

#[tokio::test]
async fn test_all_api_endpoints() {
    print_section("Setting up intel_backend");
    let Some((client, base_url, mut child)) = setup().await else {
        eprintln!("Skipping: DATABASE_URL is not set");
        return;
    };

    // ── Health & System ──
    print_section("Health & System");

    let (status, body) = check_endpoint(&client, &base_url, "/api/health", "health").await;
    assert_eq!(status, StatusCode::OK, "health endpoint");
    assert!(
        body.get("status").is_some(),
        "health should have status field"
    );

    let (status, _body) = check_endpoint(
        &client,
        &base_url,
        "/api/system/disclosure-coverage",
        "disclosure-coverage",
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "disclosure-coverage should return 200"
    );

    let (status, _body) = check_endpoint(
        &client,
        &base_url,
        "/api/system/worker-health",
        "worker-health",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "worker-health should return 200");

    let (status, body) =
        check_endpoint(&client, &base_url, "/api/home/summary", "home-summary").await;
    assert_eq!(status, StatusCode::OK, "home summary");
    assert!(body.is_object(), "home summary should be an object");

    let (status, _body) =
        check_endpoint(&client, &base_url, "/api/sources/status", "sources-status").await;
    assert_eq!(status, StatusCode::OK, "sources status should return 200");

    let (status, _body) = check_endpoint(
        &client,
        &base_url,
        "/api/sources/coverage",
        "sources-coverage",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "sources coverage should return 200");

    // ── Members ──
    print_section("Members");

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/legislators?limit=5",
        "legislators-list",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "legislators list");
    assert!(body.is_array(), "legislators list should be an array");
    assert!(
        !body.as_array().unwrap().is_empty(),
        "legislators list should not be empty"
    );
    if let Some(first) = body.as_array().unwrap().first() {
        assert!(
            first["bioguide_id"].as_str().is_some(),
            "member should have bioguide_id"
        );
    }

    // Test both profile routes
    let member_endpoint = format!("/api/legislators/{TEST_MEMBER}");
    let (status, body) =
        check_endpoint(&client, &base_url, &member_endpoint, "legislator-profile").await;
    if status == StatusCode::NOT_FOUND {
        println!("  Member {TEST_MEMBER} not found — profiles will be skipped");
    } else {
        assert_eq!(status, StatusCode::OK, "legislator profile");
        assert_eq!(body["bioguide_id"], TEST_MEMBER);
        assert!(
            body["first_name"].as_str().is_some_and(|s| !s.is_empty()),
            "first_name should be present"
        );
        assert!(
            body["last_name"].as_str().is_some_and(|s| !s.is_empty()),
            "last_name should be present"
        );

        // /api/members/:bioguide_id/votes
        let (status, body) = check_endpoint(
            &client,
            &base_url,
            &format!("/api/members/{TEST_MEMBER}/votes?congress=119&limit=10"),
            "member-votes",
        )
        .await;
        if status == StatusCode::NOT_FOUND {
            assert_json_error(status, &body);
        } else {
            assert_eq!(status, StatusCode::OK, "member votes");
            assert!(body["votes"].is_array(), "votes should be an array");
            if let Some(vote) = body["votes"].as_array().and_then(|votes| votes.first()) {
                assert!(vote["description"].is_string());
                assert!(vote["result"].is_string());
                assert!(vote["measure"]["kind"].as_str().is_some_and(|kind| {
                    matches!(
                        kind,
                        "amendment" | "nomination" | "procedure" | "bill" | "other"
                    )
                }));
                assert!(vote["measure"]["label"].is_string());
            }
            if let Some(summary) = body["summary"].as_object() {
                assert!(summary["party_line_eligible_votes"].is_number());
                assert!(summary["first_vote_date"].is_string());
                assert!(summary["last_vote_date"].is_string());
            }
        }

        // /api/members/:bioguide_id/legislation
        let (status, body) = check_endpoint(
            &client,
            &base_url,
            &format!("/api/members/{TEST_MEMBER}/legislation"),
            "member-legislation",
        )
        .await;
        if status == StatusCode::NOT_FOUND {
            assert_json_error(status, &body);
        } else {
            assert_eq!(status, StatusCode::OK, "member legislation");
            assert!(body["sponsor"].is_array(), "sponsor should be an array");
            assert!(body["cosponsor"].is_array(), "cosponsor should be an array");
        }

        // /api/members/:bioguide_id/disclosures
        let (status, body) = check_endpoint(
            &client,
            &base_url,
            &format!("/api/members/{TEST_MEMBER}/disclosures"),
            "member-disclosures",
        )
        .await;
        if status == StatusCode::NOT_FOUND {
            assert_json_error(status, &body);
        } else {
            assert_eq!(status, StatusCode::OK, "member disclosures");
            assert!(body["documents"].is_array(), "documents should be an array");
            assert!(body["holdings"].is_array(), "holdings should be an array");
            assert!(
                body["transactions"].is_array(),
                "transactions should be an array"
            );
        }

        // Range-safe annual financial snapshots and Senate eFD staging.
        let (status, body) = check_endpoint(
            &client,
            &base_url,
            "/api/financial-snapshots?limit=5",
            "financial-snapshots",
        )
        .await;
        assert_eq!(status, StatusCode::OK, "financial snapshots");
        assert!(body["snapshots"].is_array(), "snapshots should be an array");
        assert!(
            body["provenance"].is_object(),
            "snapshot provenance should be present"
        );

        let (status, body) = check_endpoint(
            &client,
            &base_url,
            "/api/senate-disclosures?limit=5",
            "senate-disclosures",
        )
        .await;
        assert_eq!(status, StatusCode::OK, "Senate disclosures");
        assert!(
            body["reports"].is_array(),
            "Senate reports should be an array"
        );

        // /api/members/:bioguide_id/funding
        let (status, body) = check_endpoint(
            &client,
            &base_url,
            &format!("/api/members/{TEST_MEMBER}/funding?cycle=2026"),
            "member-funding",
        )
        .await;
        if status == StatusCode::NOT_FOUND {
            assert_json_error(status, &body);
        } else {
            assert_eq!(status, StatusCode::OK, "member funding");
            assert_eq!(body["bioguide_id"], TEST_MEMBER);
            assert!(
                body["direct_receipts"].as_f64().is_some(),
                "direct_receipts should be present"
            );
            assert!(
                body["top_donors"].is_array(),
                "top_donors should be an array"
            );
        }
    }

    // Test unknown member returns 404 with well-formed error
    let unknown_member_url = format!("/api/legislators/{UNKNOWN_MEMBER}");
    let (status, body) =
        check_endpoint(&client, &base_url, &unknown_member_url, "unknown-member").await;
    assert_eq!(status, StatusCode::NOT_FOUND, "unknown member should 404");
    assert_json_error(status, &body);

    // ── Bills ──
    print_section("Bills");

    let (status, body) =
        check_endpoint(&client, &base_url, "/api/bills?limit=5", "bills-list").await;
    assert_eq!(status, StatusCode::OK, "bills list");
    assert!(
        body.is_array() || body.get("bills").or_else(|| body.get("results")).is_some(),
        "bills list should be array or have bills/results field"
    );

    // Unknown bill must return a well-formed error
    let (status, body) = check_endpoint(
        &client,
        &base_url,
        &format!("/api/bills/{UNKNOWN_BILL}"),
        "bills-get",
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "unknown bill must 404");
    assert_json_error(status, &body);

    // Unknown bill intel must return a well-formed error
    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/bills/119/hr/1234/intel",
        "bill-intel",
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "unknown bill intel must 404");
    assert_json_error(status, &body);

    // Populated-dataset M5 proof: normalized amendments live in the compound
    // response and explicit LDA citations are distinct from heuristic matches.
    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/bills/119/hr/6489/intel",
        "bill-intel-evidence-contract",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "known bill intelligence");
    assert!(
        body["amendments"].is_array(),
        "bill intel must include normalized amendments"
    );
    let direct_links = body["lobbying_bill_links"]
        .as_array()
        .expect("bill intel must include explicit LDA bill links");
    assert!(
        !direct_links.is_empty(),
        "known bill should retain its explicit LDA citation"
    );
    assert!(direct_links
        .iter()
        .all(|link| link["confidence"] == "direct"));
    assert!(body["lobbying_overlay"]
        .as_array()
        .expect("bill intel must include heuristic suggestions")
        .iter()
        .all(|suggestion| suggestion["confidence"] == "heuristic"));

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/bills/119/hr/6489/amendments",
        "bill-amendments",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "bill amendments");
    assert_eq!(
        body["total"].as_u64(),
        body["amendments"].as_array().map(|rows| rows.len() as u64)
    );

    // Visualization totals must equal the exact precomputed canonical summary,
    // while displayed sectors remain a bounded top-N presentation.
    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/visualizations/campaign-finance?cycle=2026",
        "campaign-finance-visualization",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "campaign finance visualization");
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL was present during setup");
    let pool = sqlx::PgPool::connect(&database_url)
        .await
        .expect("connect for parity query");
    let canonical: (f64, f64, f64, f64, i64) = sqlx::query_as(
        "SELECT total_receipts::float8, total_disbursements::float8, independent_supporting::float8, independent_opposing::float8, committee_count FROM fec_campaign_finance_cycle_summaries WHERE election_cycle = 2026",
    )
    .fetch_one(&pool)
    .await
    .expect("2026 canonical campaign-finance summary");
    for (field, expected) in [
        ("total_receipts", canonical.0),
        ("total_disbursements", canonical.1),
        ("independent_expenditures_supporting", canonical.2),
        ("independent_expenditures_opposing", canonical.3),
    ] {
        let actual = body[field]
            .as_f64()
            .unwrap_or_else(|| panic!("{field} must be numeric"));
        assert!(
            (actual - expected).abs() < 0.01,
            "{field} differs from canonical summary"
        );
    }
    assert_eq!(body["committee_count"].as_i64(), Some(canonical.4));
    assert!(body["by_sector"]
        .as_array()
        .is_some_and(|sectors| sectors.len() <= 20));

    // ── Influence ──
    print_section("Influence");

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/influence/networks",
        "influence-networks",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "influence networks");
    assert!(
        body.is_array() || body.get("networks").is_some(),
        "networks should be array or have networks field"
    );

    // Unknown network slug
    let (status, body) = check_endpoint(
        &client,
        &base_url,
        &format!("/api/influence/networks/{UNKNOWN_SLUG}"),
        "influence-network-slug",
    )
    .await;
    if status == StatusCode::NOT_FOUND {
        assert_json_error(status, &body);
    } else {
        assert_eq!(status, StatusCode::OK, "network by slug");
    }

    // Unknown network financials
    let (status, body) = check_endpoint(
        &client,
        &base_url,
        &format!("/api/influence/networks/{UNKNOWN_SLUG}/financials"),
        "influence-network-financials",
    )
    .await;
    if status == StatusCode::NOT_FOUND {
        assert_json_error(status, &body);
    } else {
        assert_eq!(status, StatusCode::OK, "network financials");
    }

    // ── Committees ──
    print_section("Committees");

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/committees?limit=5",
        "committees-list",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "committees list");
    assert!(
        body.is_array() || body.get("committees").is_some(),
        "committees should be array or have committees field"
    );

    // Unknown committee
    let (status, body) = check_endpoint(
        &client,
        &base_url,
        &format!("/api/committees/{UNKNOWN_COMMITTEE}"),
        "committee-get",
    )
    .await;
    if status == StatusCode::NOT_FOUND {
        assert_json_error(status, &body);
    } else {
        assert_eq!(status, StatusCode::OK, "committee detail");
    }

    // ── Chambers ──
    print_section("Chambers");

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/chambers/house/dashboard",
        "chamber-house",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "house dashboard");
    assert!(body.is_object(), "house dashboard should be an object");

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/chambers/senate/dashboard",
        "chamber-senate",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "senate dashboard");
    assert!(body.is_object(), "senate dashboard should be an object");

    // Bad chamber must return 404 with a well-formed error
    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/chambers/void/dashboard",
        "chamber-void",
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "unknown chamber must 404");
    assert_json_error(status, &body);

    // ── Trades & Portfolio ──
    print_section("Trades & Portfolio");

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/intel/trades?limit=5",
        "intel-trades",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "intel trades");
    assert!(
        body.is_array() || body.get("trades").is_some(),
        "trades should be array or have trades field"
    );

    // Unknown ticker
    let (status, body) = check_endpoint(
        &client,
        &base_url,
        &format!("/api/intel/trades/{UNKNOWN_TICKER}"),
        "trades-by-ticker",
    )
    .await;
    if status == StatusCode::NOT_FOUND {
        assert_json_error(status, &body);
    } else {
        assert_eq!(status, StatusCode::OK, "trades by ticker");
        assert!(body.get("trades").is_some_and(Value::is_array));
        assert!(body.get("total").is_some_and(Value::is_number));
        assert!(body["coverage"]["has_more"].is_boolean());
    }

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/stocks/transactions?limit=5",
        "stocks-transactions",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "stocks/transactions");
    assert!(
        body.is_array() || body.get("trades").is_some(),
        "transactions should be array or have trades field"
    );

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/stocks/transactions?ticker=AAPL",
        "removed-global-ticker-filter",
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "unsupported ticker query");
    assert_json_error(status, &body);

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        &format!("/api/members/{TEST_MEMBER}/trades?limit=5&offset=0"),
        "member-stock-transactions",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "member stock transactions");
    assert!(body.get("trades").is_some_and(Value::is_array));
    assert!(body.get("total").is_some_and(Value::is_number));
    assert_eq!(body["limit"], 5);
    assert!(body["coverage"]["status"].is_string());
    assert!(body["coverage"]["has_more"].is_boolean());
    assert!(body["coverage"]["excluded_date_anomalies"].is_number());

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        &format!("/api/members/{UNKNOWN_MEMBER}/trades?limit=5"),
        "unknown-member-stock-transactions",
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "unknown member stock transactions"
    );
    assert_json_error(status, &body);

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/intel/portfolio/summary",
        "portfolio-summary",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "portfolio summary");
    assert!(body.is_object(), "portfolio summary should be object");

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/intel/portfolio/members?limit=5",
        "portfolio-members",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "portfolio members");
    assert!(
        body.is_array() || body.get("members").is_some(),
        "portfolio members should be array or have members field"
    );

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/portfolios?limit=5",
        "portfolios-alias",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "portfolios alias");
    assert!(
        body.is_array() || body.get("members").is_some(),
        "portfolios should be array or have members field"
    );

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/intel/portfolio/sectors",
        "portfolio-sectors",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "portfolio sectors");
    assert!(
        body.is_array() || body.is_object(),
        "sectors should be array or object"
    );

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/intel/portfolio/pulse",
        "portfolio-pulse",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "portfolio pulse");
    assert!(
        body.is_object() || body.is_array(),
        "pulse should be object or array"
    );

    // ── Search ──
    print_section("Search");

    let (status, body) = check_endpoint(&client, &base_url, "/api/search?q=health", "search").await;
    assert_eq!(status, StatusCode::OK, "search");
    // Search could return array or object with results
    assert!(
        body.is_array() || body.get("results").is_some() || body.get("members").is_some(),
        "search should return results"
    );

    // ── Relationships & Organizations ──
    print_section("Relationships & Organizations");

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/relationships?limit=5",
        "relationships",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "relationships");
    assert!(
        body.get("relationships").is_some(),
        "relationships should have relationships field"
    );

    // Unknown organization
    let (status, body) = check_endpoint(
        &client,
        &base_url,
        &format!("/api/organizations/{UNKNOWN_ORG}"),
        "organization-get",
    )
    .await;
    if status == StatusCode::NOT_FOUND {
        assert_json_error(status, &body);
    } else {
        assert_eq!(status, StatusCode::OK, "organization detail");
    }

    // ── Lobbying ──
    print_section("Lobbying");

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/lobbying/filings?limit=5",
        "lobbying-filings",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "lobbying filings");
    assert!(
        body.is_array() || body.get("filings").is_some(),
        "filings should be array or have filings field"
    );

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/lobbying/filings?search=defense&limit=5",
        "lobbying-filings-search",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "lobbying search");
    assert!(
        body.get("filings").is_some() && body.get("total").is_some(),
        "lobbying search should preserve paginated response shape"
    );

    // Unknown filing
    let (status, body) = check_endpoint(
        &client,
        &base_url,
        &format!("/api/lobbying/filings/{UNKNOWN_LOBBYING}"),
        "lobbying-filing-get",
    )
    .await;
    if status == StatusCode::NOT_FOUND {
        assert_json_error(status, &body);
    } else {
        assert_eq!(status, StatusCode::OK, "lobbying filing detail");
    }

    for (path, field) in [
        ("/api/lobbying/clients?limit=2", "clients"),
        ("/api/lobbying/registrants?limit=2", "registrants"),
        ("/api/lobbying/lobbyists?limit=2", "lobbyists"),
    ] {
        let (status, body) = check_endpoint(&client, &base_url, path, field).await;
        assert_eq!(status, StatusCode::OK, "{field} list");
        assert!(body[field].is_array(), "{field} should be an array");
        assert!(body["total"].is_number(), "{field} should include total");
    }

    // ── FEC ──
    print_section("FEC");

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/intel/fec/candidates?limit=5",
        "fec-candidates",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "fec candidates");
    assert!(
        body.is_array() || body.get("candidates").is_some(),
        "candidates should be array or have candidates field"
    );

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/intel/fec/committees?limit=5",
        "fec-committees",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "fec committees");
    assert!(
        body.is_array() || body.get("committees").is_some(),
        "fec committees should be array or have committees field"
    );

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/fec/receipts?cycle=2026&page=1&per_page=5",
        "fec-receipts",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "fec receipts");
    assert!(body["data"].is_array(), "fec receipts should expose data");
    assert!(
        body["meta"]["paging"].is_object(),
        "fec receipts should expose paging"
    );
    assert!(
        body["meta"]["coverage_status"].is_string(),
        "fec receipts should expose ingestion coverage"
    );
    assert!(
        body["meta"]["unresolved_linkage_issues"].is_i64(),
        "fec receipts should expose unresolved official linkage coverage"
    );
    assert!(
        body["provenance"].is_object(),
        "fec receipts should expose provenance"
    );

    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/fec/disbursements?cycle=2026&page=1&per_page=5",
        "fec-disbursements",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "fec disbursements");
    assert!(body["data"].is_array(), "disbursements should expose data");
    assert!(
        body["meta"]["paging"].is_object(),
        "disbursements should expose paging"
    );
    assert!(
        body["meta"]["coverage_status"].is_string(),
        "disbursements should expose ingestion coverage"
    );
    assert!(
        body["provenance"].is_object(),
        "disbursements should expose provenance"
    );

    // Alias route
    let (status, body) = check_endpoint(
        &client,
        &base_url,
        "/api/elections/candidates?limit=5",
        "elections-candidates",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "elections candidates alias");
    assert!(
        body.is_array() || body.get("candidates").is_some(),
        "elections candidates should have data"
    );

    // Operational entity-resolution review is private tooling, not part of
    // the unauthenticated public data plane.
    let (status, _) = check_endpoint(
        &client,
        &base_url,
        "/api/admin/entity-resolution-queue?limit=5",
        "private-admin-route",
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "admin route must not be public"
    );

    // ── Done ──
    println!("\n─── All endpoints tested ───");
    kill_server(&mut child).await;
    println!("✓ full API contract test complete");
}
