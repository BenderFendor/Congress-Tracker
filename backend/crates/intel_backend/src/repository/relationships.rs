use crate::models::LobbyingBillLink;
use crate::repository::Repository;

pub struct RelationshipEvidenceInsert<'a> {
    pub subject_key: &'a str,
    pub object_key: &'a str,
    pub relation_type: &'a str,
    pub evidence_tier: &'a str,
    pub confidence: &'a str,
    pub source: &'a str,
    pub source_record_id: Option<&'a str>,
    pub source_url: Option<&'a str>,
    pub observed_at: Option<chrono::NaiveDate>,
    pub details: serde_json::Value,
    pub source_run_id: Option<uuid::Uuid>,
}

impl Repository {
    pub async fn upsert_relationship_evidence(
        &self,
        input: RelationshipEvidenceInsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO relationship_evidence
               (subject_key, object_key, relation_type, evidence_tier, confidence, source, source_record_id, source_url, observed_at, details, source_run_id)
               VALUES ($1, $2, $3, $4, $5::confidence_level, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (subject_key, object_key, relation_type, source, source_record_id)
               DO UPDATE SET
                 evidence_tier = EXCLUDED.evidence_tier,
                 confidence = EXCLUDED.confidence,
                 details = EXCLUDED.details"#,
        )
        .bind(input.subject_key)
        .bind(input.object_key)
        .bind(input.relation_type)
        .bind(input.evidence_tier)
        .bind(input.confidence)
        .bind(input.source)
        .bind(input.source_record_id)
        .bind(input.source_url)
        .bind(input.observed_at)
        .bind(input.details)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Get relationship evidence for a given bill object
    pub async fn get_bill_lobbying_links(
        &self,
        bill_id: &str,
    ) -> Result<Vec<LobbyingBillLink>, sqlx::Error> {
        let object_key = format!("bill:{}", bill_id);
        let rows: Vec<LobbyingBillLinkRow> = sqlx::query_as(
            r#"SELECT re.subject_key AS filing_uuid, re.details->>'matched_bill_text' AS matched_bill_text,
                      lr.name AS registrant_name, lc.name AS client_name,
                      re.evidence_tier, re.confidence::text AS confidence, re.source
               FROM relationship_evidence re
               JOIN lobbying_filings lf ON lf.filing_uuid = re.subject_key
               LEFT JOIN lobbying_registrants lr ON lr.id = lf.registrant_id
               LEFT JOIN lobbying_clients lc ON lc.id = lf.client_id
               WHERE re.object_key = $1 AND re.relation_type = 'lobbied'
                 AND re.evidence_tier = 'direct' AND re.source = 'lda'
                 AND re.confidence NOT IN ('low', 'heuristic')
               ORDER BY re.observed_at DESC NULLS LAST
               LIMIT 20"#,
        )
        .bind(&object_key)
        .fetch_all(self.pool())
        .await?;

        Ok(rows
            .into_iter()
            .filter(is_direct_lda_bill_evidence)
            .map(|r| LobbyingBillLink {
                filing_uuid: r.filing_uuid,
                registrant_name: r.registrant_name.unwrap_or_default(),
                client_name: r.client_name.unwrap_or_default(),
                matched_bill_text: r.matched_bill_text,
                confidence: "direct".to_string(),
            })
            .collect())
    }
}

#[derive(sqlx::FromRow)]
struct LobbyingBillLinkRow {
    filing_uuid: String,
    registrant_name: Option<String>,
    client_name: Option<String>,
    matched_bill_text: Option<String>,
    evidence_tier: String,
    confidence: String,
    source: String,
}

fn is_direct_lda_bill_evidence(row: &LobbyingBillLinkRow) -> bool {
    row.evidence_tier == "direct"
        && row.source == "lda"
        && !matches!(row.confidence.as_str(), "low" | "heuristic")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn evidence(tier: &str, confidence: &str, source: &str) -> LobbyingBillLinkRow {
        LobbyingBillLinkRow {
            filing_uuid: "filing-1".into(),
            registrant_name: None,
            client_name: None,
            matched_bill_text: Some("H.R. 6489".into()),
            evidence_tier: tier.into(),
            confidence: confidence.into(),
            source: source.into(),
        }
    }

    #[test]
    fn direct_lda_bill_evidence_excludes_heuristic_suggestions() {
        assert!(is_direct_lda_bill_evidence(&evidence(
            "direct", "medium", "lda"
        )));
        assert!(!is_direct_lda_bill_evidence(&evidence(
            "heuristic",
            "medium",
            "lda"
        )));
        assert!(!is_direct_lda_bill_evidence(&evidence(
            "direct",
            "heuristic",
            "lda"
        )));
        assert!(!is_direct_lda_bill_evidence(&evidence(
            "direct", "medium", "derived"
        )));
    }
}
