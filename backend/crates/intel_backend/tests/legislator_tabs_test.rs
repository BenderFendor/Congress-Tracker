use reqwest::StatusCode;
use serde_json::Value;
use std::net::TcpListener;
use std::process::{Child, Command};
use std::time::Duration;
use tokio::time::{sleep, timeout};

const TEST_MEMBER: &str = "A000370"; // Alma Adams — most complete data

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
    Some(
        Command::new("cargo")
            .args(["run", "-p", "intel_backend", "--bin", "intel_backend"])
            .env("DATABASE_URL", database_url)
            .env("PORT", port.to_string())
            .spawn()
            .expect("Failed to start intel_backend"),
    )
}

async fn setup() -> Option<(reqwest::Client, String, Child)> {
    let port = get_available_port();
    let child = spawn_intel_backend(port)?;
    let base_url = format!("http://127.0.0.1:{port}");
    let client = wait_for_health(&base_url).await;
    Some((client, base_url, child))
}

/// Pretty-print a JSON value for test output, truncating deep / long arrays.
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

fn print_section(label: &str) {
    println!("\n─── {label} ───");
}

async fn kill_server(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_legislator_profile_endpoint() {
    print_section("GET /api/members/A000370/profile");
    let Some((client, base_url, mut child)) = setup().await else {
        eprintln!("Skipping: DATABASE_URL is not set");
        return;
    };

    let resp = client
        .get(format!("{base_url}/api/members/{TEST_MEMBER}/profile"))
        .send()
        .await
        .expect("profile request failed");

    let status = resp.status();
    let body: Value = resp.json().await.expect("profile response was not JSON");

    if status == StatusCode::NOT_FOUND {
        println!("  Member {TEST_MEMBER} not found in database — skipping assertions");
        summarize_json("body", &body);
        kill_server(&mut child).await;
        return;
    }

    assert_eq!(status, StatusCode::OK, "profile status: {status}");
    assert_eq!(body["bioguide_id"], TEST_MEMBER, "bioguide_id mismatch");
    assert!(
        body["first_name"].as_str().is_some_and(|s| !s.is_empty()),
        "first_name should be present"
    );
    assert!(
        body["last_name"].as_str().is_some_and(|s| !s.is_empty()),
        "last_name should be present"
    );
    assert!(
        body["current_party"]
            .as_str()
            .is_some_and(|s| !s.is_empty()),
        "current_party should be present"
    );
    assert!(
        body["current_state"]
            .as_str()
            .is_some_and(|s| !s.is_empty()),
        "current_state should be present"
    );
    assert!(
        body["current_chamber"]
            .as_str()
            .is_some_and(|s| !s.is_empty()),
        "current_chamber should be present"
    );
    assert!(body["in_office"].is_boolean(), "in_office should be bool");
    assert!(
        body["committees"].is_array(),
        "committees should be an array"
    );
    assert!(body["terms"].is_array(), "terms should be an array");
    assert!(
        body["provenance"].is_object(),
        "provenance should be present"
    );
    if body["biography_summary"].is_string() || body["biography_full"].is_string() {
        let sources = body["provenance"]["sources"]
            .as_array()
            .expect("biography provenance sources should be an array");
        assert!(
            sources.iter().any(|source| {
                matches!(source["source"].as_str(), Some("wikidata" | "wikipedia"))
            }),
            "externally enriched biography text must identify Wikidata or Wikipedia provenance"
        );
    }

    summarize_json("profile", &body);
    println!(
        "  ✓ bioguide_id={}, party={}, state={}, chamber={}, committees={}, terms={}",
        body["bioguide_id"].as_str().unwrap_or("?"),
        body["current_party"].as_str().unwrap_or("?"),
        body["current_state"].as_str().unwrap_or("?"),
        body["current_chamber"].as_str().unwrap_or("?"),
        body["committees"].as_array().map(|a| a.len()).unwrap_or(0),
        body["terms"].as_array().map(|a| a.len()).unwrap_or(0),
    );

    kill_server(&mut child).await;
}

#[tokio::test]
async fn test_legislator_funding_endpoint() {
    print_section("GET /api/members/A000370/funding?cycle=2026");
    let Some((client, base_url, mut child)) = setup().await else {
        eprintln!("Skipping: DATABASE_URL is not set");
        return;
    };

    let resp = client
        .get(format!(
            "{base_url}/api/members/{TEST_MEMBER}/funding?cycle=2026"
        ))
        .send()
        .await
        .expect("funding request failed");

    let status = resp.status();
    let body: Value = resp.json().await.expect("funding response was not JSON");

    if status == StatusCode::NOT_FOUND {
        println!("  Member {TEST_MEMBER} not found — skipping");
        summarize_json("body", &body);
        kill_server(&mut child).await;
        return;
    }

    assert_eq!(status, StatusCode::OK, "funding status: {status}");
    assert_eq!(body["bioguide_id"], TEST_MEMBER);
    assert!(
        body["cycle"].as_i64().is_some(),
        "cycle should be an integer"
    );
    assert!(
        body["direct_receipts"].as_f64().is_some(),
        "direct_receipts should be a number"
    );
    assert!(
        body["pac_receipts"].as_f64().is_some(),
        "pac_receipts should be a number"
    );
    assert!(
        body["individual_receipts"].as_f64().is_some(),
        "individual_receipts should be a number"
    );
    assert!(
        body["top_donors"].is_array(),
        "top_donors should be an array"
    );
    assert!(
        body["top_committees"].is_array(),
        "top_committees should be an array"
    );
    assert!(
        body["influence_networks"].is_array(),
        "influence_networks should be an array"
    );
    assert!(
        body["has_successful_fec_run"].is_boolean(),
        "has_successful_fec_run should be bool"
    );
    assert!(
        body["provenance"].is_object(),
        "provenance should be present"
    );
    let live_totals = body["provenance"]["sources"]
        .as_array()
        .map(|sources| {
            sources
                .iter()
                .any(|source| source["source"] == "openfec" && source["status"] == "live_totals")
        })
        .unwrap_or(false);
    if live_totals {
        assert!(
            body["top_donors"].as_array().is_some_and(Vec::is_empty),
            "candidate totals must not masquerade as complete donor rankings"
        );
        assert!(
            body["top_committees"].as_array().is_some_and(Vec::is_empty),
            "candidate totals must not masquerade as complete committee rankings"
        );
        assert!(
            body["provenance"]["warnings"]
                .as_array()
                .is_some_and(|warnings| warnings.iter().any(|warning| {
                    warning.as_str().is_some_and(|text| {
                        text.contains("canonical paginated FEC transaction ingest")
                    })
                })),
            "live totals must disclose the missing paginated ranking data"
        );
    }

    // Check first donor shape if present
    if let Some(donors) = body["top_donors"].as_array() {
        if let Some(first) = donors.first() {
            assert!(
                first["contributor_name"].as_str().is_some(),
                "donor should have contributor_name"
            );
            assert!(
                first["amount"].as_f64().is_some(),
                "donor should have amount"
            );
        }
    }

    // Check first committee shape if present
    if let Some(committees) = body["top_committees"].as_array() {
        if let Some(first) = committees.first() {
            assert!(
                first["committee_id"].as_str().is_some(),
                "committee should have committee_id"
            );
            assert!(
                first["committee_name"].as_str().is_some(),
                "committee should have committee_name"
            );
        }
    }

    summarize_json("funding", &body);
    println!(
        "  ✓ cycle={}, direct={:.2}, pac={:.2}, individual={:.2}, donors={}, committees={}, fec_run={}",
        body["cycle"].as_i64().unwrap_or(0),
        body["direct_receipts"].as_f64().unwrap_or(0.0),
        body["pac_receipts"].as_f64().unwrap_or(0.0),
        body["individual_receipts"].as_f64().unwrap_or(0.0),
        body["top_donors"].as_array().map(|a| a.len()).unwrap_or(0),
        body["top_committees"].as_array().map(|a| a.len()).unwrap_or(0),
        body["has_successful_fec_run"].as_bool().unwrap_or(false),
    );

    kill_server(&mut child).await;
}

#[tokio::test]
async fn test_legislator_votes_endpoint() {
    print_section("GET /api/members/A000370/votes?congress=119&limit=100");
    let Some((client, base_url, mut child)) = setup().await else {
        eprintln!("Skipping: DATABASE_URL is not set");
        return;
    };

    let resp = client
        .get(format!(
            "{base_url}/api/members/{TEST_MEMBER}/votes?congress=119&limit=100"
        ))
        .send()
        .await
        .expect("votes request failed");

    let status = resp.status();
    let body: Value = resp.json().await.expect("votes response was not JSON");

    if status == StatusCode::NOT_FOUND {
        println!("  Member {TEST_MEMBER} not found — skipping");
        summarize_json("body", &body);
        kill_server(&mut child).await;
        return;
    }

    assert_eq!(status, StatusCode::OK, "votes status: {status}");
    assert_eq!(body["bioguide_id"], TEST_MEMBER);
    assert!(
        body["congress"].as_i64().is_some(),
        "congress should be an integer"
    );
    assert!(body["votes"].is_array(), "votes should be an array");

    // Validate first vote shape if present
    if let Some(votes) = body["votes"].as_array() {
        if let Some(first) = votes.first() {
            assert!(
                first["vote_id"].as_str().is_some(),
                "vote should have vote_id"
            );
            assert!(
                first["chamber"].as_str().is_some(),
                "vote should have chamber"
            );
            assert!(
                first["roll_number"].as_i64().is_some(),
                "vote should have roll_number"
            );
            assert!(
                first["position"].as_str().is_some(),
                "vote should have position"
            );
        }
    }

    // Check summary shape if present
    if let Some(summary) = body.get("summary") {
        if !summary.is_null() {
            assert!(
                summary["total_votes"].as_i64().is_some(),
                "summary should have total_votes"
            );
            assert!(
                summary["missed_votes"].as_i64().is_some(),
                "summary should have missed_votes"
            );
        }
    }

    summarize_json("votes", &body);
    println!(
        "  ✓ congress={}, votes={}, has_summary={}",
        body["congress"].as_i64().unwrap_or(0),
        body["votes"].as_array().map(|a| a.len()).unwrap_or(0),
        body.get("summary").and_then(|s| s.as_object()).is_some(),
    );

    kill_server(&mut child).await;
}

#[tokio::test]
async fn test_legislator_legislation_endpoint() {
    print_section("GET /api/members/A000370/legislation");
    let Some((client, base_url, mut child)) = setup().await else {
        eprintln!("Skipping: DATABASE_URL is not set");
        return;
    };

    let resp = client
        .get(format!("{base_url}/api/members/{TEST_MEMBER}/legislation"))
        .send()
        .await
        .expect("legislation request failed");

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .expect("legislation response was not JSON");

    if status == StatusCode::NOT_FOUND {
        println!("  Member {TEST_MEMBER} not found — skipping");
        summarize_json("body", &body);
        kill_server(&mut child).await;
        return;
    }

    assert_eq!(status, StatusCode::OK, "legislation status: {status}");
    assert_eq!(body["bioguide_id"], TEST_MEMBER);
    assert!(body["sponsor"].is_array(), "sponsor should be an array");
    assert!(body["cosponsor"].is_array(), "cosponsor should be an array");
    assert!(
        body["provenance"].is_object(),
        "provenance should be present"
    );

    // Validate first sponsor bill shape if present
    if let Some(sponsor) = body["sponsor"].as_array() {
        if let Some(first) = sponsor.first() {
            assert!(
                first["bill_id"].as_str().is_some(),
                "bill should have bill_id"
            );
            assert!(first["title"].as_str().is_some(), "bill should have title");
            assert!(
                first["status"].as_str().is_some(),
                "bill should have status"
            );
        }
    }

    // Validate first cosponsor bill shape if present
    if let Some(cosponsor) = body["cosponsor"].as_array() {
        if let Some(first) = cosponsor.first() {
            assert!(
                first["bill_id"].as_str().is_some(),
                "cosponsor bill should have bill_id"
            );
            assert!(
                first["title"].as_str().is_some(),
                "cosponsor bill should have title"
            );
        }
    }

    summarize_json("legislation", &body);
    println!(
        "  ✓ sponsor={}, cosponsor={}",
        body["sponsor"].as_array().map(|a| a.len()).unwrap_or(0),
        body["cosponsor"].as_array().map(|a| a.len()).unwrap_or(0),
    );

    kill_server(&mut child).await;
}

#[tokio::test]
async fn test_legislator_relationships_endpoint() {
    print_section("GET /api/relationships?subject_key=member:A000370&limit=25");
    let Some((client, base_url, mut child)) = setup().await else {
        eprintln!("Skipping: DATABASE_URL is not set");
        return;
    };

    let subject_key = format!("member:{TEST_MEMBER}");
    let resp = client
        .get(format!(
            "{base_url}/api/relationships?subject_key={subject_key}&limit=25"
        ))
        .send()
        .await
        .expect("relationships request failed");

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .expect("relationships response was not JSON");

    assert_eq!(status, StatusCode::OK, "relationships status: {status}");

    assert!(
        body["relationships"].is_array(),
        "relationships should be an array"
    );
    assert!(
        body["provenance"].is_object(),
        "provenance should be present"
    );

    // Validate first relationship shape if present
    if let Some(rels) = body["relationships"].as_array() {
        if let Some(first) = rels.first() {
            assert!(
                first["relationship_id"].as_i64().is_some(),
                "relationship should have relationship_id"
            );
            assert!(
                first["relation_type"].as_str().is_some(),
                "relationship should have relation_type"
            );
            assert!(
                first["subject_key"].as_str().is_some(),
                "relationship should have subject_key"
            );
            assert!(
                first["object_key"].as_str().is_some(),
                "relationship should have object_key"
            );
            assert!(
                first["evidence_tier"].as_str().is_some(),
                "relationship should have evidence_tier"
            );
        }
    }

    summarize_json("relationships", &body);
    println!(
        "  ✓ count={}",
        body["relationships"]
            .as_array()
            .map(|a| a.len())
            .unwrap_or(0),
    );

    kill_server(&mut child).await;
}

#[tokio::test]
async fn test_legislator_disclosures_endpoint() {
    print_section("GET /api/members/A000370/disclosures");
    let Some((client, base_url, mut child)) = setup().await else {
        eprintln!("Skipping: DATABASE_URL is not set");
        return;
    };

    let resp = client
        .get(format!("{base_url}/api/members/{TEST_MEMBER}/disclosures"))
        .send()
        .await
        .expect("disclosures request failed");

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .expect("disclosures response was not JSON");

    if status == StatusCode::NOT_FOUND {
        println!("  Member {TEST_MEMBER} not found — skipping");
        summarize_json("body", &body);
        kill_server(&mut child).await;
        return;
    }

    assert_eq!(status, StatusCode::OK, "disclosures status: {status}");
    assert_eq!(body["bioguide_id"], TEST_MEMBER);
    assert!(body["documents"].is_array(), "documents should be an array");
    assert!(body["holdings"].is_array(), "holdings should be an array");
    assert!(
        body["transactions"].is_array(),
        "transactions should be an array"
    );
    assert!(
        body["provenance"].is_object(),
        "provenance should be present"
    );

    // Validate first document shape if present
    if let Some(docs) = body["documents"].as_array() {
        if let Some(first) = docs.first() {
            assert!(
                first["document_id"].as_i64().is_some(),
                "document should have document_id"
            );
            assert!(
                first["chamber"].as_str().is_some(),
                "document should have chamber"
            );
            assert!(
                first["report_type"].as_str().is_some(),
                "document should have report_type"
            );
        }
    }

    // Validate first holding shape if present
    if let Some(holdings) = body["holdings"].as_array() {
        if let Some(first) = holdings.first() {
            assert!(
                first["asset_name"].as_str().is_some(),
                "holding should have asset_name"
            );
        }
    }

    summarize_json("disclosures", &body);
    println!(
        "  ✓ documents={}, holdings={}, transactions={}",
        body["documents"].as_array().map(|a| a.len()).unwrap_or(0),
        body["holdings"].as_array().map(|a| a.len()).unwrap_or(0),
        body["transactions"]
            .as_array()
            .map(|a| a.len())
            .unwrap_or(0),
    );

    kill_server(&mut child).await;
}

#[tokio::test]
async fn test_members_list_endpoint() {
    print_section("GET /api/legislators?limit=5");
    let Some((client, base_url, mut child)) = setup().await else {
        eprintln!("Skipping: DATABASE_URL is not set");
        return;
    };

    let resp = client
        .get(format!("{base_url}/api/legislators?limit=5"))
        .send()
        .await
        .expect("members list request failed");

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .expect("members list response was not JSON");

    assert_eq!(status, StatusCode::OK, "members list status: {status}");

    assert!(body.is_array(), "members list should be an array");
    assert!(
        !body.as_array().unwrap().is_empty(),
        "members list should not be empty"
    );
    assert!(
        body.as_array().unwrap().len() <= 5,
        "members list should respect limit"
    );

    // Validate first member shape
    if let Some(members) = body.as_array() {
        if let Some(first) = members.first() {
            assert!(
                first["bioguide_id"].as_str().is_some(),
                "member should have bioguide_id"
            );
            assert!(
                first["first_name"].as_str().is_some() || first["last_name"].as_str().is_some(),
                "member should have name fields"
            );
            assert!(
                first["current_party"].as_str().is_some(),
                "member should have party"
            );
            assert!(
                first["current_state"].as_str().is_some(),
                "member should have state"
            );
        }
    }

    summarize_json("members list", &body);
    for member in body.as_array().unwrap_or(&vec![]) {
        let name = format!(
            "{} {}",
            member["first_name"].as_str().unwrap_or("?"),
            member["last_name"].as_str().unwrap_or("?")
        );
        println!(
            "  - {name} ({party}-{state}, {chamber})",
            name = name.trim(),
            party = member["current_party"].as_str().unwrap_or("?"),
            state = member["current_state"].as_str().unwrap_or("?"),
            chamber = member["current_chamber"].as_str().unwrap_or("?"),
        );
    }

    kill_server(&mut child).await;
}
