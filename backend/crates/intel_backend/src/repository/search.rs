use crate::models::{CommitteeInfo, SearchResults};
use crate::repository::Repository;

impl Repository {
    /// Run a parallel cross-entity search across members, bills, committees,
    /// PACs, lobbying clients, and lobbying registrants.
    pub async fn cross_entity_search(
        &self,
        query: &str,
        limit: i64,
    ) -> Result<SearchResults, sqlx::Error> {
        let query_owned = query.to_string();

        let members_fut = self.search_members(&query_owned, limit);
        let bills_fut = self.search_bills(&query_owned, limit);
        let committees_fut = self.search_committees(&query_owned, limit);
        let pacs_fut = self.search_pacs(&query_owned, limit);
        let clients_fut = self.search_lobbying_clients(&query_owned, limit);
        let registrants_fut = self.search_lobbying_registrants(&query_owned, limit);

        let (members, bills, committees, pacs, clients, registrants) = tokio::join!(
            members_fut,
            bills_fut,
            committees_fut,
            pacs_fut,
            clients_fut,
            registrants_fut,
        );

        Ok(SearchResults {
            query: query_owned,
            members: members.unwrap_or_default(),
            bills: bills.unwrap_or_default(),
            committees: committees.unwrap_or_default(),
            pacs: pacs.unwrap_or_default(),
            lobbying_clients: clients.unwrap_or_default(),
            lobbying_registrants: registrants.unwrap_or_default(),
        })
    }

    /// Search committees by name or jurisdiction.
    async fn search_committees(
        &self,
        query: &str,
        limit: i64,
    ) -> Result<Vec<CommitteeInfo>, sqlx::Error> {
        let pattern = format!("%{}%", query);
        let rows: Vec<CommInfoRow> = sqlx::query_as::<_, CommInfoRow>(
            r#"SELECT committee_id, chamber, name, jurisdiction, NULL::text AS committee_type
               FROM committees
               WHERE name ILIKE $1
                  OR COALESCE(jurisdiction, '') ILIKE $1
               ORDER BY name ASC
               LIMIT $2"#,
        )
        .bind(&pattern)
        .bind(limit)
        .fetch_all(self.pool())
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| CommitteeInfo {
                committee_id: r.committee_id,
                chamber: r.chamber,
                name: r.name,
                jurisdiction: r.jurisdiction,
                committee_type: r.committee_type,
            })
            .collect())
    }
}

// ── Private row types ───────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct CommInfoRow {
    committee_id: String,
    chamber: String,
    name: String,
    jurisdiction: Option<String>,
    committee_type: Option<String>,
}
