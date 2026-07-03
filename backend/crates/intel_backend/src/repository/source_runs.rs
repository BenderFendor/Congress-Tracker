use crate::repository::Repository;

impl Repository {
    /// Insert a new source ingestion run and return its UUID.
    pub async fn create_source_run(
        &self,
        source: &str,
        endpoint: &str,
        params: serde_json::Value,
    ) -> Result<uuid::Uuid, sqlx::Error> {
        let row: (uuid::Uuid,) = sqlx::query_as(
            "INSERT INTO source_runs (source, endpoint, params)
             VALUES ($1, $2, $3)
             RETURNING id",
        )
        .bind(source)
        .bind(endpoint)
        .bind(params)
        .fetch_one(self.pool())
        .await?;

        Ok(row.0)
    }

    /// Mark a source run as finished with the given status and row counts.
    pub async fn finish_source_run(
        &self,
        id: uuid::Uuid,
        status: &str,
        rows_seen: i64,
        rows_written: i64,
        error: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE source_runs
             SET finished_at = now(),
                 status     = $1::source_run_status,
                 rows_seen  = $2,
                 rows_written = $3,
                 error_message = COALESCE($4, error_message)
             WHERE id = $5",
        )
        .bind(status)
        .bind(rows_seen)
        .bind(rows_written)
        .bind(error)
        .bind(id)
        .execute(self.pool())
        .await?;

        Ok(())
    }
}
