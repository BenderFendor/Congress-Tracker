// Database connection pool and migration management.

/// Wrapper around a SQLx PostgreSQL connection pool.
#[derive(Clone)]
pub struct Db {
    pool: sqlx::PgPool,
}

impl Db {
    /// Access the underlying connection pool.
    pub fn pool(&self) -> &sqlx::PgPool {
        &self.pool
    }

    /// Create a new connection pool from a database URL.
    ///
    /// # Errors
    /// Returns `sqlx::Error` if the pool cannot be created or a connection
    /// cannot be established.
    pub async fn connect(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = sqlx::PgPool::connect(database_url).await?;
        Ok(Self { pool })
    }

    /// Run all pending SQL migrations defined in the `migrations/` directory.
    ///
    /// # Errors
    /// Returns `sqlx::Error` if migration fails.
    pub async fn migrate(&self) -> Result<(), sqlx::Error> {
        sqlx::migrate!("./migrations")
            .run(&self.pool)
            .await
            .map_err(|e| sqlx::Error::Protocol(e.to_string()))
    }

    /// Quick health check — runs `SELECT 1` against the database.
    pub async fn health(&self) -> bool {
        sqlx::query("SELECT 1").execute(&self.pool).await.is_ok()
    }
}
