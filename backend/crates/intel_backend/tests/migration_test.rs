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
