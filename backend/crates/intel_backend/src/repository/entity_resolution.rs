use crate::models::EntityResolutionEntry;
use crate::repository::Repository;

pub struct EntityResolutionQueueInput<'a> {
    pub entity_type: &'a str,
    pub source_scheme: &'a str,
    pub source_value: &'a str,
    pub candidate_bioguide_id: Option<&'a str>,
    pub confidence_score: f64,
    pub reason: &'a str,
    pub raw_json: serde_json::Value,
    pub source_run_id: Option<uuid::Uuid>,
}

impl Repository {
    /// Insert a new entity resolution queue entry.
    pub async fn queue_entity_resolution(
        &self,
        input: EntityResolutionQueueInput<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO entity_resolution_queue
               (entity_type, source_scheme, source_value, candidate_bioguide_id,
                confidence_score, reason, raw_json, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
        )
        .bind(input.entity_type)
        .bind(input.source_scheme)
        .bind(input.source_value)
        .bind(input.candidate_bioguide_id)
        .bind(input.confidence_score)
        .bind(input.reason)
        .bind(input.raw_json)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// List entity resolution queue entries, optionally filtered by status.
    pub async fn get_resolution_queue(
        &self,
        status: Option<&str>,
        limit: i64,
    ) -> Result<Vec<EntityResolutionEntry>, sqlx::Error> {
        let rows: Vec<QueueRow> = if let Some(st) = status {
            sqlx::query_as::<_, QueueRow>(
                r#"SELECT id, entity_type, source_scheme, source_value,
                          candidate_bioguide_id, confidence_score, reason, status
                   FROM entity_resolution_queue
                   WHERE status = $1
                   ORDER BY confidence_score DESC, id ASC
                   LIMIT $2"#,
            )
            .bind(st)
            .bind(limit)
            .fetch_all(self.pool())
            .await?
        } else {
            sqlx::query_as::<_, QueueRow>(
                r#"SELECT id, entity_type, source_scheme, source_value,
                          candidate_bioguide_id, confidence_score, reason, status
                   FROM entity_resolution_queue
                   ORDER BY status ASC, confidence_score DESC, id ASC
                   LIMIT $1"#,
            )
            .bind(limit)
            .fetch_all(self.pool())
            .await?
        };

        Ok(rows
            .into_iter()
            .map(|r| EntityResolutionEntry {
                id: r.id,
                entity_type: r.entity_type,
                source_scheme: r.source_scheme,
                source_value: r.source_value,
                candidate_bioguide_id: r.candidate_bioguide_id,
                confidence_score: r.confidence_score,
                reason: r.reason,
                status: r.status,
            })
            .collect())
    }

    /// Update the status of a resolution queue entry.
    pub async fn update_resolution_status(&self, id: i64, status: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE entity_resolution_queue SET status = $1 WHERE id = $2")
            .bind(status)
            .bind(id)
            .execute(self.pool())
            .await?;

        Ok(())
    }

    /// Resolve an FEC candidate_id to a bioguide_id via member_identifiers.
    pub async fn resolve_bioguide_by_fec(
        &self,
        candidate_id: &str,
    ) -> Result<Option<String>, sqlx::Error> {
        let row: Option<(String,)> = sqlx::query_as(
            r#"SELECT bioguide_id FROM member_identifiers WHERE scheme = 'fec' AND value = $1"#,
        )
        .bind(candidate_id)
        .fetch_optional(self.pool())
        .await?;

        Ok(row.map(|(b,)| b))
    }

    /// Resolve an ICPSR ID to a bioguide_id via member_identifiers.
    pub async fn resolve_bioguide_by_icpsr(
        &self,
        icpsr: &str,
    ) -> Result<Option<String>, sqlx::Error> {
        let row: Option<(String,)> = sqlx::query_as(
            r#"SELECT bioguide_id FROM member_identifiers WHERE scheme = 'icpsr' AND value = $1"#,
        )
        .bind(icpsr)
        .fetch_optional(self.pool())
        .await?;

        Ok(row.map(|(b,)| b))
    }

    /// Attempt name+state+chamber matching as a fallback resolution strategy.
    ///
    /// Returns `(bioguide_id, confidence_score)` where score is 0.85 for
    /// name+state+chamber match or 0.65 for name+state only.
    pub async fn resolve_bioguide_by_name_state(
        &self,
        full_name: &str,
        state: &str,
        chamber: &str,
    ) -> Result<Option<(String, f64)>, sqlx::Error> {
        // Normalize: lowercase and split first/last
        let parts: Vec<&str> = full_name.split_whitespace().collect();
        if parts.is_empty() {
            return Ok(None);
        }
        let last_name = parts.last().copied().unwrap_or("");
        let first_name = parts.first().copied().unwrap_or("");

        // Try exact name + state + chamber first
        if !chamber.is_empty() {
            let row: Option<(String,)> = sqlx::query_as(
                r#"SELECT bioguide_id FROM members
                   WHERE last_name ILIKE $1
                     AND first_name ILIKE $2
                     AND current_state = $3
                     AND current_chamber = $4
                   LIMIT 1"#,
            )
            .bind(last_name)
            .bind(first_name)
            .bind(state)
            .bind(chamber)
            .fetch_optional(self.pool())
            .await?;

            if let Some((bid,)) = row {
                return Ok(Some((bid, 0.85)));
            }
        }

        // Try name + state only
        if !state.is_empty() {
            let row: Option<(String,)> = sqlx::query_as(
                r#"SELECT bioguide_id FROM members
                   WHERE last_name ILIKE $1
                     AND first_name ILIKE $2
                     AND current_state = $3
                   LIMIT 1"#,
            )
            .bind(last_name)
            .bind(first_name)
            .bind(state)
            .fetch_optional(self.pool())
            .await?;

            if let Some((bid,)) = row {
                return Ok(Some((bid, 0.65)));
            }
        }

        Ok(None)
    }
}

// ── Private row types ───────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct QueueRow {
    id: i64,
    entity_type: String,
    source_scheme: String,
    source_value: String,
    candidate_bioguide_id: Option<String>,
    confidence_score: f64,
    reason: String,
    status: String,
}
