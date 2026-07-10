//! Integration tests for the ingestion pipeline.
//!
//! These tests run the ingest binary against a live PostgreSQL database and
//! verify that data is properly written. They skip cleanly when DATABASE_URL
//! is not set and do NOT reset or truncate any tables.
//!
//! Each test that invokes the CLI runs the ingest binary via `cargo run`,
//! capturing stdout/stderr for diagnostics on failure.

use std::process::Stdio;
use std::time::Duration;

// ── Helpers ────────────────────────────────────────────────────────────────

/// If DATABASE_URL is absent, print a skip message and return `true`.
fn skip_if_no_db() -> bool {
    let db_url = std::env::var("DATABASE_URL").unwrap_or_default();
    if db_url.is_empty() {
        eprintln!("SKIP: DATABASE_URL not set");
        true
    } else {
        false
    }
}

/// Run the ingest binary with the given CLI arguments.
///
/// The binary is invoked via `cargo run -p intel_backend --bin ingest -- …`
/// so it rebuilds automatically when the source changes.  Stderr and stdout
/// are captured (not forwarded) to keep test output clean.
async fn run_ingest(args: &[&str], timeout_secs: u64) -> std::process::Output {
    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for run_ingest");
    let label = format!("ingest {}", args.join(" "));

    let mut cmd = tokio::process::Command::new("cargo");
    cmd.args([
        "run",
        "-p",
        "intel_backend",
        "--bin",
        "ingest",
        "--color",
        "never",
        "--",
    ])
    .args(args)
    .env("DATABASE_URL", &db_url)
    .env("CARGO_TERM_COLOR", "never")
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
    tokio::time::timeout(Duration::from_secs(timeout_secs), cmd.output())
        .await
        .unwrap_or_else(|_| panic!("ingest command timed out after {timeout_secs}s: {label}"))
        .expect("ingest process failed to start")
}

/// Build a database connection pool from `DATABASE_URL`.
async fn db_pool() -> sqlx::PgPool {
    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    sqlx::PgPool::connect(&db_url)
        .await
        .expect("failed to connect to database")
}

/// Print a detailed failure summary for a failed ingest command.
fn print_failure(output: &std::process::Output, label: &str) {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    eprintln!("── {label} FAILED (exit: {:?}) ──", output.status.code());
    if !stdout.is_empty() {
        eprintln!("stdout:\n{stdout}");
    }
    if !stderr.is_empty() {
        eprintln!("stderr:\n{stderr}");
    }
}

// ── Tests ──────────────────────────────────────────────────────────────────

/// 1. Smoke test the ingest CLI: run the `all-smoke` command and verify
///    it exits successfully.  This validates the entire pipeline is wired
///    correctly end-to-end.
#[tokio::test]
async fn test_ingest_all_smoke_exits_success() {
    if skip_if_no_db() {
        return;
    }
    let output = run_ingest(&["all-smoke"], 300).await;
    if !output.status.success() {
        print_failure(&output, "all-smoke");
    }
    assert!(
        output.status.success(),
        "all-smoke command failed with exit code {:?}",
        output.status.code()
    );
    println!("all-smoke passed (exit: {:?})", output.status.code());
}

/// 2. Verify member identifiers: after ingesting members, check that
///    `member_identifiers` has FEC crosswalks for known members.
#[tokio::test]
async fn test_ingest_members_populates_identifiers() {
    if skip_if_no_db() {
        return;
    }
    let output = run_ingest(&["members", "--current-only", "--limit", "10"], 120).await;
    if !output.status.success() {
        print_failure(&output, "members");
    }
    assert!(
        output.status.success(),
        "members command failed with exit code {:?}",
        output.status.code()
    );

    let pool = db_pool().await;

    // Members were inserted
    let member_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM members WHERE in_office = true")
            .fetch_one(&pool)
            .await
            .expect("query failed");
    assert!(
        member_count > 0,
        "expected at least 1 in-office member, got {member_count}"
    );

    // Identifiers were populated (crosswalks like bioguide -> fec, opensecrets, etc.)
    let ident_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM member_identifiers")
        .fetch_one(&pool)
        .await
        .expect("query failed");
    assert!(
        ident_count > 0,
        "expected member_identifiers, got {ident_count}"
    );

    // Specifically check FEC crosswalks
    let fec_ident_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM member_identifiers WHERE scheme = 'fec'")
            .fetch_one(&pool)
            .await
            .expect("query failed");
    assert!(
        fec_ident_count > 0,
        "expected FEC identifiers, got {fec_ident_count}"
    );

    // Show which schemes are present
    let schemes: Vec<String> =
        sqlx::query_scalar("SELECT DISTINCT scheme FROM member_identifiers ORDER BY scheme")
            .fetch_all(&pool)
            .await
            .expect("query failed");

    println!(
        "Members: {member_count}, identifiers: {ident_count} (FEC: {fec_ident_count}), schemes: {schemes:?}"
    );
}

/// 3. Verify FEC candidate loading: test that `fec-candidates` populates
///    the `fec_candidates` table.
#[tokio::test]
async fn test_ingest_fec_candidates() {
    if skip_if_no_db() {
        return;
    }

    let api_key = std::env::var("OPENFEC_API_KEY").unwrap_or_else(|_| "DEMO_KEY".to_string());
    let is_demo = api_key == "DEMO_KEY";

    let output = run_ingest(&["fec-candidates", "--cycle", "2026", "--limit", "5"], 120).await;

    // With DEMO_KEY the command may fail due to rate limits; we tolerate that.
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if is_demo && stderr.contains("rate") {
            eprintln!("SKIP-ish: OpenFEC rate-limited (DEMO_KEY). Set OPENFEC_API_KEY for reliable FEC tests.");
            // Still check the DB if any data was loaded despite the error
        } else {
            print_failure(&output, "fec-candidates");
            panic!(
                "fec-candidates command failed with exit code {:?}",
                output.status.code()
            );
        }
    }

    let pool = db_pool().await;

    // The table may or may not have data depending on API key / rate limits
    let candidate_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM fec_candidates")
        .fetch_one(&pool)
        .await
        .expect("query failed");

    if candidate_count == 0 && is_demo {
        eprintln!("Note: fec_candidates is empty — likely due to OpenFEC DEMO_KEY rate limits.");
        eprintln!("      Set OPENFEC_API_KEY to a real key for data.");
        return;
    }

    assert!(
        candidate_count > 0,
        "expected fec_candidates rows, got {candidate_count}"
    );

    let cycles: Vec<i32> = sqlx::query_scalar(
        "SELECT DISTINCT active_through FROM fec_candidates WHERE active_through IS NOT NULL ORDER BY active_through",
    )
    .fetch_all(&pool)
    .await
    .expect("query failed");

    println!("FEC candidates: {candidate_count}, cycles: {cycles:?}");
}

/// 4. Verify materialized views: test that `refresh-materialized-views`
///    succeeds and the views are queryable.
#[tokio::test]
async fn test_ingest_refresh_views() {
    if skip_if_no_db() {
        return;
    }
    let output = run_ingest(&["refresh-materialized-views"], 60).await;
    if !output.status.success() {
        print_failure(&output, "refresh-materialized-views");
    }
    assert!(
        output.status.success(),
        "refresh-materialized-views command failed with exit code {:?}",
        output.status.code()
    );

    let pool = db_pool().await;

    // All three materialized views should be queryable after refresh.
    // They may contain zero rows if no transaction data has been loaded,
    // but the query itself must not error.
    let mv_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM member_funding_cycle_mv")
        .fetch_one(&pool)
        .await
        .expect("member_funding_cycle_mv should be queryable");

    let vote_mv: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM member_vote_summary_mv")
        .fetch_one(&pool)
        .await
        .expect("member_vote_summary_mv should be queryable");

    let inf_mv: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM influence_network_member_mv")
        .fetch_one(&pool)
        .await
        .expect("influence_network_member_mv should be queryable");

    println!(
        "MV rows — member_funding_cycle_mv: {mv_count}, member_vote_summary_mv: {vote_mv}, influence_network_member_mv: {inf_mv}"
    );
}

/// 5. Verify source runs: after ingestion, check that `source_runs` has
///    entries with status='success'.
#[tokio::test]
async fn test_ingest_source_runs_tracked() {
    if skip_if_no_db() {
        return;
    }

    // Run a small members ingest to generate a tracked source run
    let output = run_ingest(&["members", "--current-only", "--limit", "3"], 120).await;
    if !output.status.success() {
        print_failure(&output, "members (source_runs test)");
    }
    assert!(
        output.status.success(),
        "members command failed in source_runs test"
    );

    let pool = db_pool().await;

    // Should have at least one source_runs entry
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM source_runs")
        .fetch_one(&pool)
        .await
        .expect("query failed");
    assert!(total > 0, "expected source_runs, got {total}");

    // At least one source run should have finished successfully
    let success_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM source_runs WHERE status = 'success'")
            .fetch_one(&pool)
            .await
            .expect("query failed");
    assert!(
        success_count > 0,
        "expected successful source_runs, got {success_count}"
    );

    // Show source distribution
    #[derive(sqlx::FromRow)]
    struct SourceSummary {
        source: String,
        status: String,
        count: i64,
    }
    let summary: Vec<SourceSummary> = sqlx::query_as(
        "SELECT source, status::text, COUNT(*)::bigint as count
         FROM source_runs
         GROUP BY source, status
         ORDER BY source, status",
    )
    .fetch_all(&pool)
    .await
    .expect("query failed");

    println!("Source runs: {total} total, {success_count} successful");
    for s in &summary {
        println!("  {} / {}: {}", s.source, s.status, s.count);
    }
}

/// 6. Test idempotency: run the same ingestion command twice and verify
///    that ON CONFLICT handlers prevent data duplication.
#[tokio::test]
async fn test_ingest_idempotent() {
    if skip_if_no_db() {
        return;
    }

    // First run
    let output1 = run_ingest(&["members", "--current-only", "--limit", "5"], 120).await;
    if !output1.status.success() {
        print_failure(&output1, "members (idempotent run 1)");
    }
    assert!(
        output1.status.success(),
        "First members command failed with exit code {:?}",
        output1.status.code()
    );

    // Second run with identical arguments
    let output2 = run_ingest(&["members", "--current-only", "--limit", "5"], 120).await;
    if !output2.status.success() {
        print_failure(&output2, "members (idempotent run 2)");
    }
    assert!(
        output2.status.success(),
        "Second members command failed with exit code {:?}",
        output2.status.code()
    );

    let pool = db_pool().await;

    // Primary-key constraint: no duplicate bioguide_id in members
    let member_total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM members")
        .fetch_one(&pool)
        .await
        .expect("query failed");
    let member_distinct: i64 =
        sqlx::query_scalar("SELECT COUNT(DISTINCT bioguide_id) FROM members")
            .fetch_one(&pool)
            .await
            .expect("query failed");
    assert_eq!(
        member_total, member_distinct,
        "members has duplicate bioguide_id rows despite ON CONFLICT handler"
    );

    // ON CONFLICT DO NOTHING on member_identifiers prevents duplicate
    // (bioguide_id, scheme, value) tuples
    let ident_total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM member_identifiers")
        .fetch_one(&pool)
        .await
        .expect("query failed");
    let ident_distinct: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM (SELECT DISTINCT bioguide_id, scheme, value FROM member_identifiers) AS sub",
    )
    .fetch_one(&pool)
    .await
    .expect("query failed");
    assert_eq!(
        ident_total, ident_distinct,
        "member_identifiers has duplicate (bioguide_id, scheme, value) tuples despite ON CONFLICT DO NOTHING"
    );

    // ON CONFLICT DO UPDATE on member_terms prevents duplicate
    // (bioguide_id, chamber, state, district, start_date) rows
    let term_total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM member_terms")
        .fetch_one(&pool)
        .await
        .expect("query failed");
    let term_distinct: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM (SELECT DISTINCT bioguide_id, chamber, state, district, start_date FROM member_terms) AS sub",
    )
    .fetch_one(&pool)
    .await
    .expect("query failed");
    assert_eq!(
        term_total, term_distinct,
        "member_terms has duplicate (bioguide_id, chamber, state, district, start_date) rows despite ON CONFLICT handler"
    );

    println!(
        "Idempotency OK — members: {member_total}, identifiers: {ident_total}, terms: {term_total} (no duplicates)"
    );
}

/// 7. Source chronology anomalies must never become negative derived filing
/// intervals. The source dates remain available for inspection, while the
/// materialized view reports an unavailable interval instead.
#[tokio::test]
async fn test_stock_trade_lag_never_negative() {
    if skip_if_no_db() {
        return;
    }

    let pool = db_pool().await;
    let negative_lags: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM stock_trades WHERE disclosure_lag_days < 0")
            .fetch_one(&pool)
            .await
            .expect("stock_trades should expose disclosure_lag_days");

    assert_eq!(
        negative_lags, 0,
        "source chronology anomalies must not become negative filing lags"
    );
}
