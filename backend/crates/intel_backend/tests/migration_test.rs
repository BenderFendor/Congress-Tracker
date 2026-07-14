//! Dedicated PostgreSQL migration verification for CI and local release checks.
//!
//! These tests are ignored during the normal Rust suite because each requires
//! an isolated, disposable database named by `MIGRATION_TEST_DATABASE_URL`.

use sqlx::migrate::Migrator;
use sqlx::{PgPool, Row};
use std::borrow::Cow;
use std::path::Path;

const PRIOR_COMMITTED_VERSION: i64 = 16;

fn database_url() -> String {
    std::env::var("MIGRATION_TEST_DATABASE_URL")
        .expect("MIGRATION_TEST_DATABASE_URL must name a disposable PostgreSQL database")
}

async fn load_migrator() -> Migrator {
    Migrator::new(Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations"))
        .await
        .expect("migration files must resolve")
}

async fn assert_complete(pool: &PgPool, migrator: &Migrator) {
    let expected_versions = migrator
        .iter()
        .filter(|migration| !migration.migration_type.is_down_migration())
        .count() as i64;
    let row = sqlx::query(
        "SELECT COUNT(*)::bigint AS applied, COALESCE(MAX(version), 0)::bigint AS latest, \
         COUNT(*) FILTER (WHERE NOT success)::bigint AS failed FROM _sqlx_migrations",
    )
    .fetch_one(pool)
    .await
    .expect("migration ledger must be queryable");

    assert_eq!(row.get::<i64, _>("applied"), expected_versions);
    assert_eq!(
        row.get::<i64, _>("latest"),
        migrator
            .iter()
            .map(|migration| migration.version)
            .max()
            .unwrap()
    );
    assert_eq!(row.get::<i64, _>("failed"), 0);
}

async fn assert_worker_duplicate_delivery_is_idempotent(pool: &PgPool) {
    for _ in 0..2 {
        sqlx::query(
            "INSERT INTO ingest_jobs (job_type, source_name, source_year, source_document_id) \
             VALUES ('download_document', 'm6_fixture', 2026, 'duplicate-report') \
             ON CONFLICT DO NOTHING",
        )
        .execute(pool)
        .await
        .expect("duplicate delivery enqueue must remain conflict-safe");
    }
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ingest_jobs \
         WHERE job_type='download_document' AND source_name='m6_fixture' \
           AND source_year=2026 AND source_document_id='duplicate-report'",
    )
    .fetch_one(pool)
    .await
    .expect("duplicate delivery fixture must remain queryable");
    assert_eq!(
        count, 1,
        "one active source document must have one active job"
    );

    for identity in [
        "filings:2026:page:1:size:25",
        "filings:2026:page:1:size:25",
        "filings:2026:page:26:size:25",
    ] {
        sqlx::query(
            "INSERT INTO ingest_jobs
             (job_type, source_name, source_year, source_document_id)
             VALUES ('refresh_lobbying', 'lda', 2026, $1)
             ON CONFLICT DO NOTHING",
        )
        .bind(identity)
        .execute(pool)
        .await
        .expect("LDA refresh page enqueue remains conflict-safe");
    }
    let lda_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ingest_jobs
         WHERE job_type='refresh_lobbying' AND source_name='lda' AND source_year=2026",
    )
    .fetch_one(pool)
    .await
    .expect("LDA refresh jobs remain queryable");
    assert_eq!(
        lda_count, 2,
        "duplicate pages collapse but continuation pages remain distinct"
    );
}

async fn assert_lobbying_continuation_transition(pool: &PgPool) {
    let job_id: i64 = sqlx::query_scalar(
        "UPDATE ingest_jobs SET status='running', locked_by='migration-test', locked_at=now()
         WHERE job_type='refresh_lobbying' AND source_name='lda'
           AND source_year=2026 AND source_document_id='filings:2026:page:1:size:25'
         RETURNING id",
    )
    .fetch_one(pool)
    .await
    .expect("first LDA page can be claimed");
    let mut transaction = pool.begin().await.expect("LDA transition begins");
    sqlx::query(
        "UPDATE ingest_jobs SET status='completed', finished_at=now(),
         locked_by=NULL, locked_at=NULL WHERE id=$1 AND status='running'
         AND locked_by='migration-test'",
    )
    .bind(job_id)
    .execute(&mut *transaction)
    .await
    .expect("owned LDA page completes");
    sqlx::query(
        "INSERT INTO ingest_jobs
         (job_type, source_name, source_year, source_document_id)
         VALUES ('refresh_lobbying', 'lda', 2026, 'filings:2026:page:51:size:25')",
    )
    .execute(&mut *transaction)
    .await
    .expect("continuation page enqueues in the same transaction");
    transaction.commit().await.expect("LDA transition commits");

    let states: (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*) FILTER (WHERE status='completed')::bigint,
                COUNT(*) FILTER (WHERE status='pending')::bigint
         FROM ingest_jobs WHERE job_type='refresh_lobbying' AND source_name='lda'
           AND source_year=2026",
    )
    .fetch_one(pool)
    .await
    .expect("LDA transition states remain queryable");
    assert_eq!(states, (1, 2));
}

async fn insert_nullable_disclosure_duplicate(pool: &PgPool, suffix: &str) -> i64 {
    let document_id: i64 = sqlx::query_scalar(
        "INSERT INTO disclosure_documents
         (chamber, report_type, source, source_record_id, source_url)
         VALUES ('House', 'PTR', 'migration_fixture', $1, $2)
         RETURNING document_id",
    )
    .bind(format!("nullable-{suffix}"))
    .bind(format!("https://example.test/disclosure/{suffix}"))
    .fetch_one(pool)
    .await
    .expect("nullable disclosure document fixture inserts");

    for _ in 0..2 {
        sqlx::query(
            "INSERT INTO disclosure_transactions
             (document_id, owner_type, asset_name, ticker, transaction_type, transaction_date)
             VALUES ($1, 'self', 'Null Key Asset', NULL, 'purchase', NULL)",
        )
        .bind(document_id)
        .execute(pool)
        .await
        .expect("legacy nullable semantic duplicate inserts");
    }
    document_id
}

async fn assert_nullable_disclosure_identity_is_unique(pool: &PgPool, document_id: i64) {
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM disclosure_transactions WHERE document_id = $1")
            .bind(document_id)
            .fetch_one(pool)
            .await
            .expect("nullable disclosure fixture remains queryable");
    assert_eq!(
        count, 1,
        "migration must collapse legacy semantic duplicates"
    );

    sqlx::query(
        "INSERT INTO disclosure_transactions
         (document_id, owner_type, asset_name, ticker, transaction_type, transaction_date)
         VALUES ($1, 'self', 'Null Key Asset', NULL, 'purchase', NULL)
         ON CONFLICT DO NOTHING",
    )
    .bind(document_id)
    .execute(pool)
    .await
    .expect("null-safe conflict handling remains idempotent");
    let count_after_retry: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM disclosure_transactions WHERE document_id = $1")
            .bind(document_id)
            .fetch_one(pool)
            .await
            .expect("retried disclosure fixture remains queryable");
    assert_eq!(count_after_retry, 1);
}

async fn insert_lobbying_activity_duplicates(pool: &PgPool, filing_uuid: &str) {
    sqlx::query("INSERT INTO lobbying_filings (filing_uuid) VALUES ($1)")
        .bind(filing_uuid)
        .execute(pool)
        .await
        .expect("lobbying filing fixture inserts");
    for _ in 0..2 {
        sqlx::query(
            "INSERT INTO lobbying_activities
             (filing_uuid, issue_code, issue_display, description, government_entities)
             VALUES ($1, 'TAX', 'Taxation', 'Section 45 credits', '[{\"name\":\"Treasury\"}]')",
        )
        .bind(filing_uuid)
        .execute(pool)
        .await
        .expect("legacy duplicate lobbying activity inserts");
    }
}

async fn assert_lobbying_activity_identity_is_unique(pool: &PgPool, filing_uuid: &str) {
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM lobbying_activities WHERE filing_uuid = $1")
            .bind(filing_uuid)
            .fetch_one(pool)
            .await
            .expect("lobbying activity fixture remains queryable");
    assert_eq!(count, 1, "migration must collapse semantic LDA duplicates");

    sqlx::query(
        "INSERT INTO lobbying_activities
         (filing_uuid, issue_code, issue_display, description, government_entities)
         VALUES ($1, 'TAX', 'Taxation', 'Section 45 credits', '[{\"name\":\"treasury\"}]')
         ON CONFLICT DO NOTHING",
    )
    .bind(filing_uuid)
    .execute(pool)
    .await
    .expect("lobbying activity rerun is conflict-safe");
    let count_after_retry: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM lobbying_activities WHERE filing_uuid = $1")
            .bind(filing_uuid)
            .fetch_one(pool)
            .await
            .expect("retried lobbying activity fixture remains queryable");
    assert_eq!(count_after_retry, 1);
}

async fn assert_lobbying_source_discriminators_remain_distinct(pool: &PgPool) {
    sqlx::query("INSERT INTO lobbying_filings (filing_uuid) VALUES ('identity-lda')")
        .execute(pool)
        .await
        .expect("identity filing inserts");
    for (foreign_issues, lobbyist_identity) in [
        ("Country A", serde_json::json!([])),
        ("Country B", serde_json::json!([])),
        (
            "Country A",
            serde_json::json!([{"person":{"id":7},"covered_position":"staff","is_new":false}]),
        ),
        (
            "Country A",
            serde_json::json!([{"person":{"id":8},"covered_position":"staff","is_new":false}]),
        ),
    ] {
        sqlx::query(
            "INSERT INTO lobbying_activities
             (filing_uuid, issue_code, issue_display, description,
              foreign_entity_issues, government_entities, lobbyist_identity)
             VALUES ('identity-lda', 'TAX', 'Taxation', 'Credits', $1, '[]', $2)",
        )
        .bind(foreign_issues)
        .bind(lobbyist_identity)
        .execute(pool)
        .await
        .expect("distinct source activity inserts");
    }
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM lobbying_activities WHERE filing_uuid='identity-lda'",
    )
    .fetch_one(pool)
    .await
    .expect("source activity identities remain queryable");
    assert_eq!(count, 4);

    for lobbyist_id in [7_i64, 8_i64] {
        sqlx::query("INSERT INTO lobbying_lobbyists (id, last_name) VALUES ($1, $2)")
            .bind(lobbyist_id)
            .bind(format!("Lobbyist {lobbyist_id}"))
            .execute(pool)
            .await
            .expect("activity lobbyist fixture inserts");
        sqlx::query(
            "INSERT INTO lobbying_activity_lobbyists
             (activity_id, lobbyist_id, covered_position, is_new)
             SELECT id, $1, 'staff', false FROM lobbying_activities
             WHERE filing_uuid='identity-lda'
               AND lobbyist_identity @> $2::jsonb",
        )
        .bind(lobbyist_id)
        .bind(serde_json::json!([{"person":{"id":lobbyist_id}}]))
        .execute(pool)
        .await
        .expect("activity-scoped lobbyist association inserts");
    }
    let association_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM lobbying_activity_lobbyists associations
         JOIN lobbying_activities activities ON activities.id=associations.activity_id
         WHERE activities.filing_uuid='identity-lda'",
    )
    .fetch_one(pool)
    .await
    .expect("activity-scoped associations remain queryable");
    assert_eq!(association_count, 2);
}

async fn insert_repeated_government_entity_fixture(pool: &PgPool) {
    sqlx::query("INSERT INTO lobbying_filings (filing_uuid) VALUES ('government-rename-lda')")
        .execute(pool)
        .await
        .expect("government identity filing inserts");
    sqlx::query(
        "INSERT INTO lobbying_activities
         (filing_uuid, issue_code, description, government_entities)
         VALUES ('government-rename-lda', 'ENG', 'Energy policy',
                 '[{\"id\":4,\"name\":\"DOE\"},{\"id\":4,\"name\":\"Department of Energy\"}]')",
    )
    .execute(pool)
    .await
    .expect("repeated government entity fixture inserts");
}

async fn assert_government_entity_identity_is_stable(pool: &PgPool) {
    let identity: serde_json::Value = sqlx::query_scalar(
        "SELECT government_entities FROM lobbying_activities
         WHERE filing_uuid='government-rename-lda'",
    )
    .fetch_one(pool)
    .await
    .expect("canonical government identity remains queryable");
    assert_eq!(identity, serde_json::json!([{"id": 4}]));
    sqlx::query(
        "INSERT INTO lobbying_activities
         (filing_uuid, issue_code, description, government_entities,
          foreign_entity_issues, lobbyist_identity)
         VALUES ('government-rename-lda', 'ENG', 'Energy policy',
                 '[{\"id\":4}]', NULL, '[]') ON CONFLICT DO NOTHING",
    )
    .execute(pool)
    .await
    .expect("renamed government entity rerun is conflict-safe");
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM lobbying_activities
         WHERE filing_uuid='government-rename-lda'",
    )
    .fetch_one(pool)
    .await
    .expect("government identity rerun remains queryable");
    assert_eq!(count, 1);
}

async fn assert_member_legislation_terminal_coverage_reconciles_writes(pool: &PgPool) {
    sqlx::query(
        "INSERT INTO members (bioguide_id, official_full_name, in_office)
         VALUES ('M999998', 'Migration Coverage Fixture', true)
         ON CONFLICT (bioguide_id) DO NOTHING",
    )
    .execute(pool)
    .await
    .expect("member legislation coverage fixture member inserts");
    let run_id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO source_runs (source, endpoint, params)
         VALUES ('congress_gov', '/migration/member-legislation', '{}')
         RETURNING id",
    )
    .fetch_one(pool)
    .await
    .expect("member legislation coverage fixture run inserts");

    let mismatch = sqlx::query(
        "INSERT INTO member_legislation_coverage
         (source_run_id, bioguide_id, congress, role, status,
          advertised_count, rows_seen, rows_written, pages_fetched, finished_at)
         VALUES ($1, 'M999998', 119, 'sponsor', 'loaded', 1, 1, 0, 1, now())",
    )
    .bind(run_id)
    .execute(pool)
    .await;
    assert!(
        mismatch.is_err(),
        "loaded coverage must reject advertised rows that were not persisted"
    );

    sqlx::query(
        "INSERT INTO member_legislation_coverage
         (source_run_id, bioguide_id, congress, role, status,
          advertised_count, rows_seen, rows_written, pages_fetched, finished_at)
         VALUES ($1, 'M999998', 119, 'sponsor', 'loaded', 1, 1, 1, 1, now())",
    )
    .bind(run_id)
    .execute(pool)
    .await
    .expect("fully reconciled member legislation coverage inserts");

    sqlx::query(
        "INSERT INTO member_legislation_coverage
         (source_run_id, bioguide_id, congress, role, status,
          advertised_count, rows_seen, rows_written, duplicate_rows,
          pages_fetched, finished_at)
         VALUES ($1, 'M999998', 119, 'cosponsor', 'loaded', 2, 2, 1, 1, 1, now())",
    )
    .bind(run_id)
    .execute(pool)
    .await
    .expect("explicit provider duplicates reconcile without multiplying evidence");

    for title in ["Initial title", "Corrected title"] {
        sqlx::query(
            "INSERT INTO member_legislation_items
             (bioguide_id, role, source_url, congress, item_kind, item_type,
              item_number, title, raw_item, source_run_id)
             VALUES ('M999998', 'sponsor',
                     'https://api.congress.gov/v3/amendment/119/hamdt/1',
                     119, 'amendment', 'hamdt', 1, $1, '{}', $2)
             ON CONFLICT (bioguide_id, role, source_url) DO UPDATE SET
               title=EXCLUDED.title, raw_item=EXCLUDED.raw_item,
               source_run_id=EXCLUDED.source_run_id, updated_at=now()",
        )
        .bind(title)
        .bind(run_id)
        .execute(pool)
        .await
        .expect("Member legislation evidence rerun remains idempotent");
    }
    let evidence: (i64, String) = sqlx::query_as(
        "SELECT COUNT(*)::bigint, MAX(title)::text
         FROM member_legislation_items
         WHERE bioguide_id='M999998' AND role='sponsor'",
    )
    .fetch_one(pool)
    .await
    .expect("Member legislation evidence remains queryable");
    assert_eq!(evidence, (1, "Corrected title".to_string()));
}

#[tokio::test]
#[ignore = "requires a disposable PostgreSQL database"]
async fn migration_fresh_database() {
    let pool = PgPool::connect(&database_url())
        .await
        .expect("connect fresh DB");
    let migrator = load_migrator().await;

    migrator.run(&pool).await.expect("fresh migration succeeds");
    migrator
        .run(&pool)
        .await
        .expect("fresh migration rerun is idempotent");
    assert_complete(&pool, &migrator).await;
    assert_worker_duplicate_delivery_is_idempotent(&pool).await;
    assert_lobbying_continuation_transition(&pool).await;

    let document_id: i64 = sqlx::query_scalar(
        "INSERT INTO disclosure_documents
         (chamber, report_type, source, source_record_id, source_url)
         VALUES ('House', 'PTR', 'migration_fixture', 'fresh-nullable',
                 'https://example.test/disclosure/fresh-nullable')
         RETURNING document_id",
    )
    .fetch_one(&pool)
    .await
    .expect("fresh disclosure fixture inserts");
    sqlx::query(
        "INSERT INTO disclosure_transactions
         (document_id, owner_type, asset_name, ticker, transaction_type, transaction_date)
         VALUES ($1, 'self', 'Null Key Asset', NULL, 'purchase', NULL)",
    )
    .bind(document_id)
    .execute(&pool)
    .await
    .expect("fresh nullable disclosure row inserts");
    assert_nullable_disclosure_identity_is_unique(&pool, document_id).await;
    sqlx::query("INSERT INTO lobbying_filings (filing_uuid) VALUES ('fresh-lda')")
        .execute(&pool)
        .await
        .expect("fresh lobbying filing fixture inserts");
    sqlx::query(
        "INSERT INTO lobbying_activities
         (filing_uuid, issue_code, issue_display, description, government_entities)
         VALUES ('fresh-lda', 'TAX', 'Taxation', 'Section 45 credits',
                 '[{\"name\":\"treasury\"}]')",
    )
    .execute(&pool)
    .await
    .expect("fresh lobbying activity fixture inserts");
    assert_lobbying_activity_identity_is_unique(&pool, "fresh-lda").await;
    assert_lobbying_source_discriminators_remain_distinct(&pool).await;
    assert_member_legislation_terminal_coverage_reconciles_writes(&pool).await;
}

#[tokio::test]
#[ignore = "requires a disposable PostgreSQL database"]
async fn migration_upgrade_from_prior_committed_schema() {
    let pool = PgPool::connect(&database_url())
        .await
        .expect("connect upgrade DB");
    let full = load_migrator().await;
    let prior_migrations = full
        .iter()
        .filter(|migration| migration.version <= PRIOR_COMMITTED_VERSION)
        .cloned()
        .collect::<Vec<_>>();
    assert_eq!(
        prior_migrations.last().map(|migration| migration.version),
        Some(PRIOR_COMMITTED_VERSION),
        "the prior committed schema boundary must remain explicit"
    );
    let prior = Migrator {
        migrations: Cow::Owned(prior_migrations),
        ..Migrator::DEFAULT
    };

    prior
        .run(&pool)
        .await
        .expect("prior schema migration succeeds");
    let prior_latest: i64 = sqlx::query_scalar("SELECT MAX(version) FROM _sqlx_migrations")
        .fetch_one(&pool)
        .await
        .expect("prior migration ledger must be queryable");
    assert_eq!(prior_latest, PRIOR_COMMITTED_VERSION);

    let nullable_document_id = insert_nullable_disclosure_duplicate(&pool, "upgrade").await;
    insert_lobbying_activity_duplicates(&pool, "upgrade-lda").await;
    insert_repeated_government_entity_fixture(&pool).await;

    sqlx::query("INSERT INTO members (bioguide_id, depiction_url) VALUES ($1, $2)")
        .bind("a000370")
        .bind("https://api.congress.gov/v3/member/a000370")
        .execute(&pool)
        .await
        .expect("lowercase Bioguide migration fixture inserts");

    full.run(&pool).await.expect("upgrade migration succeeds");
    full.run(&pool)
        .await
        .expect("upgraded migration rerun is idempotent");
    assert_complete(&pool, &full).await;
    assert_nullable_disclosure_identity_is_unique(&pool, nullable_document_id).await;
    assert_lobbying_activity_identity_is_unique(&pool, "upgrade-lda").await;
    assert_government_entity_identity_is_stable(&pool).await;
    assert_lobbying_source_discriminators_remain_distinct(&pool).await;
    assert_member_legislation_terminal_coverage_reconciles_writes(&pool).await;

    let depiction_url: String =
        sqlx::query_scalar("SELECT depiction_url FROM members WHERE bioguide_id = 'a000370'")
            .fetch_one(&pool)
            .await
            .expect("portrait migration fixture remains queryable");
    assert_eq!(
        depiction_url,
        "https://bioguide.congress.gov/bioguide/photo/A/A000370.jpg"
    );
}
