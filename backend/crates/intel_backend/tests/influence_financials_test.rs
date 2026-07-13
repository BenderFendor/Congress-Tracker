//! Populated-database contract tests for influence-network financial attribution.

use intel_backend::{CacheLayer, Db, Repository};
use sqlx::PgPool;
use std::sync::Arc;

const NETWORK: &str = "fa02-contract-network";
const CYCLE: i32 = 2098;
const COMMITTEE_A: &str = "CFA020001";
const COMMITTEE_B: &str = "CFA020002";
const RECIPIENT_A: &str = "CFA029901";
const RECIPIENT_B: &str = "CFA029902";
const CANDIDATE_A: &str = "HFA020001";
const CANDIDATE_B: &str = "HFA020002";
const MEMBER_A: &str = "ZFA0201";
const MEMBER_B: &str = "ZFA0202";

async fn test_pool() -> Option<PgPool> {
    let database_url = std::env::var("DATABASE_URL").ok()?;
    Some(
        PgPool::connect(&database_url)
            .await
            .expect("connect to influence financial test database"),
    )
}

async fn cleanup(pool: &PgPool) {
    let mut transaction = pool.begin().await.expect("begin fixture cleanup");
    sqlx::query(
        "DELETE FROM fec_independent_expenditures
         WHERE election_cycle = $1 AND source_key LIKE 'fa02-contract-%'",
    )
    .bind(CYCLE)
    .execute(&mut *transaction)
    .await
    .expect("delete independent expenditure fixtures");
    sqlx::query(
        "DELETE FROM fec_canonical_committee_receipts
         WHERE sub_id BETWEEN 8880020001 AND 8880020002",
    )
    .execute(&mut *transaction)
    .await
    .expect("delete direct contribution fixtures");
    sqlx::query(
        "DELETE FROM fec_candidate_committees
         WHERE election_cycle = $1 AND candidate_id IN ($2, $3)",
    )
    .bind(CYCLE)
    .bind(CANDIDATE_A)
    .bind(CANDIDATE_B)
    .execute(&mut *transaction)
    .await
    .expect("delete candidate committee fixtures");
    sqlx::query("DELETE FROM member_identifiers WHERE bioguide_id IN ($1, $2)")
        .bind(MEMBER_A)
        .bind(MEMBER_B)
        .execute(&mut *transaction)
        .await
        .expect("delete candidate crosswalk fixtures");
    sqlx::query("DELETE FROM influence_network_committees WHERE network_slug = $1")
        .bind(NETWORK)
        .execute(&mut *transaction)
        .await
        .expect("delete network committee fixtures");
    sqlx::query("DELETE FROM influence_networks WHERE network_slug = $1")
        .bind(NETWORK)
        .execute(&mut *transaction)
        .await
        .expect("delete network fixture");
    sqlx::query("DELETE FROM fec_candidates WHERE candidate_id IN ($1, $2)")
        .bind(CANDIDATE_A)
        .bind(CANDIDATE_B)
        .execute(&mut *transaction)
        .await
        .expect("delete candidate fixtures");
    sqlx::query("DELETE FROM fec_committees WHERE committee_id IN ($1, $2)")
        .bind(RECIPIENT_A)
        .bind(RECIPIENT_B)
        .execute(&mut *transaction)
        .await
        .expect("delete recipient committee fixtures");
    sqlx::query("DELETE FROM members WHERE bioguide_id IN ($1, $2)")
        .bind(MEMBER_A)
        .bind(MEMBER_B)
        .execute(&mut *transaction)
        .await
        .expect("delete member fixtures");
    transaction.commit().await.expect("commit fixture cleanup");
}

async fn seed(pool: &PgPool) {
    cleanup(pool).await;
    let mut transaction = pool.begin().await.expect("begin fixture transaction");
    for (bioguide_id, first_name, last_name) in
        [(MEMBER_A, "Alpha", "Member"), (MEMBER_B, "Beta", "Member")]
    {
        sqlx::query(
            r#"INSERT INTO members
               (bioguide_id, first_name, last_name, official_full_name,
                current_party, current_state, current_chamber)
               VALUES ($1, $2, $3, $2 || ' ' || $3, 'Independent', 'ZZ', 'House')"#,
        )
        .bind(bioguide_id)
        .bind(first_name)
        .bind(last_name)
        .execute(&mut *transaction)
        .await
        .expect("insert member fixture");
    }
    for (candidate_id, bioguide_id, recipient_committee) in [
        (CANDIDATE_A, MEMBER_A, RECIPIENT_A),
        (CANDIDATE_B, MEMBER_B, RECIPIENT_B),
    ] {
        sqlx::query(
            "INSERT INTO fec_candidates (candidate_id, bioguide_id, name, office)
             VALUES ($1, $2, $2, 'H')",
        )
        .bind(candidate_id)
        .bind(bioguide_id)
        .execute(&mut *transaction)
        .await
        .expect("insert candidate fixture");
        sqlx::query(
            "INSERT INTO member_identifiers (bioguide_id, scheme, value)
             VALUES ($1, 'fec', $2)",
        )
        .bind(bioguide_id)
        .bind(candidate_id)
        .execute(&mut *transaction)
        .await
        .expect("insert candidate crosswalk fixture");
        sqlx::query("INSERT INTO fec_committees (committee_id, name) VALUES ($1, $1)")
            .bind(recipient_committee)
            .execute(&mut *transaction)
            .await
            .expect("insert recipient committee fixture");
        sqlx::query(
            r#"INSERT INTO fec_candidate_committees
               (candidate_id, committee_id, election_cycle)
               VALUES ($1, $2, $3)"#,
        )
        .bind(candidate_id)
        .bind(recipient_committee)
        .bind(CYCLE)
        .execute(&mut *transaction)
        .await
        .expect("insert candidate committee fixture");
    }
    sqlx::query(
        r#"INSERT INTO influence_networks
           (network_slug, display_name, description, category, confidence, source_citation)
           VALUES ($1, 'FA-02 contract network', 'test fixture', 'test', 'verified', 'test')"#,
    )
    .bind(NETWORK)
    .execute(&mut *transaction)
    .await
    .expect("insert network fixture");
    for (committee_id, committee_name) in [
        (COMMITTEE_A, "Committee Alpha"),
        (COMMITTEE_B, "Committee Beta"),
    ] {
        sqlx::query(
            r#"INSERT INTO influence_network_committees
               (network_slug, committee_id, committee_name, role, confidence, source_citation)
               VALUES ($1, $2, $3, 'independent_expenditure_filer', 'verified', 'test')"#,
        )
        .bind(NETWORK)
        .bind(committee_id)
        .bind(committee_name)
        .execute(&mut *transaction)
        .await
        .expect("insert network committee fixture");
    }
    for (sub_id, recipient, donor, amount) in [
        (8_880_020_001_i64, RECIPIENT_A, COMMITTEE_A, 100.0),
        (8_880_020_002_i64, RECIPIENT_B, COMMITTEE_B, 200.0),
    ] {
        sqlx::query(
            r#"INSERT INTO fec_canonical_committee_receipts
               (sub_id, recipient_committee_id, donor_committee_id, amount,
                election_cycle, is_current, relationship_type, include_in_totals)
               VALUES ($1, $2, $3, $4, $5, true, 'contribution', true)"#,
        )
        .bind(sub_id)
        .bind(recipient)
        .bind(donor)
        .bind(amount)
        .bind(CYCLE)
        .execute(&mut *transaction)
        .await
        .expect("insert direct contribution fixture");
    }
    for (source_key, candidate, spender, amount, support_oppose) in [
        (
            "fa02-contract-support-a",
            CANDIDATE_A,
            COMMITTEE_A,
            30.0,
            "S",
        ),
        (
            "fa02-contract-oppose-b",
            CANDIDATE_A,
            COMMITTEE_B,
            70.0,
            "O",
        ),
        (
            "fa02-contract-support-b",
            CANDIDATE_B,
            COMMITTEE_B,
            40.0,
            "S",
        ),
        (
            "fa02-contract-oppose-a",
            CANDIDATE_B,
            COMMITTEE_A,
            20.0,
            "O",
        ),
    ] {
        sqlx::query(
            r#"INSERT INTO fec_independent_expenditures
               (election_cycle, source_key, candidate_id, spender_id, amount,
                support_oppose, dedupe_method, raw_row)
               VALUES ($1, $2, $3, $4, $5, $6, 'fingerprint', '{}'::jsonb)"#,
        )
        .bind(CYCLE)
        .bind(source_key)
        .bind(candidate)
        .bind(spender)
        .bind(amount)
        .bind(support_oppose)
        .execute(&mut *transaction)
        .await
        .expect("insert independent expenditure fixture");
    }
    transaction.commit().await.expect("commit fixtures");
}

fn assert_money(actual: f64, expected: f64) {
    assert!(
        (actual - expected).abs() < 0.001,
        "expected {expected}, got {actual}"
    );
}

#[tokio::test]
async fn committee_financials_reconcile_without_counting_opposition_as_received() {
    let Some(pool) = test_pool().await else {
        eprintln!("SKIP: DATABASE_URL not set");
        return;
    };
    seed(&pool).await;
    let db = Db::connect(
        &std::env::var("DATABASE_URL").expect("DATABASE_URL was present during fixture setup"),
    )
    .await
    .expect("connect repository database");
    let repository = Repository::new(db, Arc::new(CacheLayer::new(60)));
    let result = repository
        .get_influence_network_financials(NETWORK, CYCLE)
        .await;
    cleanup(&pool).await;
    let financials = result
        .expect("query influence financial contract")
        .expect("fixture network exists");

    assert_money(financials.total_direct_contributions, 300.0);
    assert_money(financials.total_independent_supporting, 70.0);
    assert_money(financials.total_independent_opposing, 90.0);
    assert_money(financials.total_all, 460.0);
    assert_money(
        financials
            .committees
            .iter()
            .map(|committee| committee.direct_contributions)
            .sum(),
        financials.total_direct_contributions,
    );
    assert_money(
        financials
            .committees
            .iter()
            .map(|committee| committee.independent_supporting)
            .sum(),
        financials.total_independent_supporting,
    );
    assert_money(
        financials
            .committees
            .iter()
            .map(|committee| committee.independent_opposing)
            .sum(),
        financials.total_independent_opposing,
    );

    let committee_a = financials
        .committees
        .iter()
        .find(|committee| committee.committee_id == COMMITTEE_A)
        .expect("committee A financials");
    assert_money(committee_a.direct_contributions, 100.0);
    assert_money(committee_a.independent_supporting, 30.0);
    assert_money(committee_a.independent_opposing, 20.0);
    assert_money(committee_a.total, 150.0);

    let committee_b = financials
        .committees
        .iter()
        .find(|committee| committee.committee_id == COMMITTEE_B)
        .expect("committee B financials");
    assert_money(committee_b.direct_contributions, 200.0);
    assert_money(committee_b.independent_supporting, 40.0);
    assert_money(committee_b.independent_opposing, 70.0);
    assert_money(committee_b.total, 310.0);

    let member_a = financials
        .top_recipients
        .iter()
        .find(|member| member.bioguide_id == MEMBER_A)
        .expect("member A financials");
    assert_money(member_a.total_received, 100.0);
    assert_money(member_a.direct_contributions, 100.0);
    assert_money(member_a.independent_supporting, 30.0);
    assert_money(member_a.independent_opposing, 70.0);
    assert_money(member_a.total_activity, 200.0);
}
