//! Database regression tests for FEC canonicalization and rankings.

async fn db_pool() -> Option<sqlx::PgPool> {
    let database_url = std::env::var("DATABASE_URL").ok()?;
    Some(
        sqlx::PgPool::connect(&database_url)
            .await
            .expect("connect to test database"),
    )
}

#[tokio::test]
async fn latest_amendment_wins_while_memo_evidence_remains_non_totalable() {
    let Some(pool) = db_pool().await else {
        eprintln!("SKIP: DATABASE_URL not set");
        return;
    };
    let mut transaction = pool.begin().await.expect("begin transaction");
    let source_run_id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO source_runs (source, endpoint) VALUES ('openfec', '/test/fec-bulk') RETURNING id",
    )
    .fetch_one(&mut *transaction)
    .await
    .expect("insert source run");
    let batch = uuid::Uuid::new_v4();
    for (sub_id, filing_num, tran_id, amount, memo_code, record_kind, include) in [
        (
            8_990_000_001_i64,
            100_i64,
            "TX-1",
            100.0,
            None,
            "contribution",
            true,
        ),
        (
            8_990_000_002_i64,
            101_i64,
            "TX-1",
            200.0,
            None,
            "contribution",
            true,
        ),
        (
            8_990_000_003_i64,
            101_i64,
            "MEMO-1",
            50.0,
            Some("X"),
            "memo",
            false,
        ),
    ] {
        sqlx::query(
            r#"INSERT INTO fec_staging_individuals
               (sub_id, committee_id, transaction_type, entity_type,
                contributor_name, contributor_zip, contributor_employer,
                transaction_date, transaction_amount, tran_id, filing_num,
                memo_code, file_year, import_batch, record_kind, include_in_totals)
               VALUES ($1, 'C99000001', '15', 'IND', 'TEST, DONOR', '19103',
                       'TEST EMPLOYER', DATE '2026-01-01', $2, $3, $4, $5,
                       2098, $6, $7, $8)"#,
        )
        .bind(sub_id)
        .bind(amount)
        .bind(tran_id)
        .bind(filing_num)
        .bind(memo_code)
        .bind(batch)
        .bind(record_kind)
        .bind(include)
        .execute(&mut *transaction)
        .await
        .expect("insert staging fixture");
    }

    intel_backend::fec_bulk::canonicalize::canonicalize_individuals(
        &mut transaction,
        2098,
        batch,
        source_run_id,
    )
    .await
    .expect("canonicalize fixtures");

    let rows: Vec<(f64, String, bool)> = sqlx::query_as(
        "SELECT amount::double precision, record_kind, include_in_totals
         FROM fec_canonical_individual_receipts
         WHERE election_cycle = 2098
         ORDER BY include_in_totals DESC",
    )
    .fetch_all(&mut *transaction)
    .await
    .expect("read canonical fixtures");
    transaction.rollback().await.expect("rollback fixtures");

    assert_eq!(
        rows,
        vec![
            (200.0, "contribution".to_string(), true),
            (50.0, "memo".to_string(), false)
        ]
    );
}

#[tokio::test]
async fn committee_ranks_restart_at_one_for_each_candidate() {
    let Some(pool) = db_pool().await else {
        eprintln!("SKIP: DATABASE_URL not set");
        return;
    };
    let mut transaction = pool.begin().await.expect("begin transaction");
    for (candidate_id, committee_id) in [("H9ZZ00001", "C99000001"), ("H9ZZ00002", "C99000002")] {
        sqlx::query(
            "INSERT INTO fec_candidates (candidate_id, name, office)
             VALUES ($1, $1, 'H') ON CONFLICT (candidate_id) DO NOTHING",
        )
        .bind(candidate_id)
        .execute(&mut *transaction)
        .await
        .expect("insert candidate fixture");
        sqlx::query(
            "INSERT INTO fec_committees (committee_id, name)
             VALUES ($1, $1) ON CONFLICT (committee_id) DO NOTHING",
        )
        .bind(committee_id)
        .execute(&mut *transaction)
        .await
        .expect("insert recipient fixture");
        sqlx::query(
            "INSERT INTO fec_candidate_committees
             (candidate_id, committee_id, election_cycle)
             VALUES ($1, $2, 2098)",
        )
        .bind(candidate_id)
        .bind(committee_id)
        .execute(&mut *transaction)
        .await
        .expect("insert linkage fixture");
    }
    for donor_id in ["C99000003", "C99000004"] {
        sqlx::query(
            "INSERT INTO fec_committees (committee_id, name)
             VALUES ($1, $1) ON CONFLICT (committee_id) DO NOTHING",
        )
        .bind(donor_id)
        .execute(&mut *transaction)
        .await
        .expect("insert donor committee fixture");
    }
    for (sub_id, recipient, donor, amount) in [
        (8_990_000_011_i64, "C99000001", "C99000003", 10_000.0),
        (8_990_000_012_i64, "C99000002", "C99000004", 100.0),
        // Official transaction files can reference a committee absent from the
        // current cycle committee-master snapshot. Preserve the FEC ID instead
        // of failing the complete cycle rebuild.
        (8_990_000_013_i64, "C99000001", "C99999999", 50.0),
    ] {
        sqlx::query(
            r#"INSERT INTO fec_canonical_committee_receipts
               (sub_id, recipient_committee_id, donor_committee_id, amount,
                election_cycle, relationship_type, include_in_totals)
               VALUES ($1, $2, $3, $4, 2098, 'contribution', true)"#,
        )
        .bind(sub_id)
        .bind(recipient)
        .bind(donor)
        .bind(amount)
        .execute(&mut *transaction)
        .await
        .expect("insert canonical committee fixture");
    }

    intel_backend::fec_bulk::rankings::build_committee_rankings(&mut transaction, 2098)
        .await
        .expect("build committee rankings");
    let ranks: Vec<(String, String, i32)> = sqlx::query_as(
        "SELECT candidate_id, committee_id, rank
         FROM fec_candidate_committee_rankings
         WHERE election_cycle = 2098
         ORDER BY candidate_id, rank",
    )
    .fetch_all(&mut *transaction)
    .await
    .expect("read committee rankings");
    transaction.rollback().await.expect("rollback fixtures");

    assert_eq!(
        ranks,
        vec![
            ("H9ZZ00001".to_string(), "C99000003".to_string(), 1),
            ("H9ZZ00001".to_string(), "C99999999".to_string(), 2),
            ("H9ZZ00002".to_string(), "C99000004".to_string(), 1),
        ]
    );
}

#[tokio::test]
async fn public_donor_rankings_include_only_reported_individual_entities() {
    let Some(pool) = db_pool().await else {
        eprintln!("SKIP: DATABASE_URL not set");
        return;
    };
    let mut transaction = pool.begin().await.expect("begin transaction");
    sqlx::query(
        "INSERT INTO fec_candidates (candidate_id, name, office)
         VALUES ('H9ZZ00003', 'TEST CANDIDATE', 'H')
         ON CONFLICT (candidate_id) DO NOTHING",
    )
    .execute(&mut *transaction)
    .await
    .expect("insert candidate fixture");
    sqlx::query(
        "INSERT INTO fec_committees (committee_id, name)
         VALUES ('C99000005', 'TEST RECIPIENT')
         ON CONFLICT (committee_id) DO NOTHING",
    )
    .execute(&mut *transaction)
    .await
    .expect("insert committee fixture");
    sqlx::query(
        "INSERT INTO fec_candidate_committees
         (candidate_id, committee_id, election_cycle)
         VALUES ('H9ZZ00003', 'C99000005', 2096)",
    )
    .execute(&mut *transaction)
    .await
    .expect("insert linkage fixture");
    for (sub_id, name, entity_type, amount) in [
        (8_990_000_021_i64, "PERSON, TEST", "IND", 100.0),
        (8_990_000_022_i64, "ASSOCIATION, TEST", "ORG", 1_000.0),
    ] {
        sqlx::query(
            r#"INSERT INTO fec_canonical_individual_receipts
               (sub_id, committee_id, contributor_name, amount, donor_key,
                election_cycle, entity_type, record_kind, include_in_totals)
               VALUES ($1, 'C99000005', $2, $3, $2, 2096, $4,
                       'contribution', true)"#,
        )
        .bind(sub_id)
        .bind(name)
        .bind(amount)
        .bind(entity_type)
        .execute(&mut *transaction)
        .await
        .expect("insert individual ranking fixture");
    }

    intel_backend::fec_bulk::rankings::build_donor_rankings(&mut transaction, 2096)
        .await
        .expect("build donor rankings");
    let donors: Vec<String> = sqlx::query_scalar(
        "SELECT display_name
         FROM fec_candidate_donor_rankings
         WHERE candidate_id = 'H9ZZ00003' AND election_cycle = 2096
         ORDER BY rank",
    )
    .fetch_all(&mut *transaction)
    .await
    .expect("read donor rankings");
    transaction.rollback().await.expect("rollback fixtures");

    assert_eq!(donors, vec!["PERSON, TEST"]);
}
