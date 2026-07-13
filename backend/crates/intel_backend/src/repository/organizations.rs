use crate::repository::Repository;
use chrono::NaiveDate;

#[derive(Debug, Clone)]
pub struct DisclosureDocumentInput<'a> {
    pub bioguide_id: Option<&'a str>,
    pub chamber: &'a str,
    pub report_type: &'a str,
    pub filing_date: Option<NaiveDate>,
    pub reporting_period_start: Option<NaiveDate>,
    pub reporting_period_end: Option<NaiveDate>,
    pub source: &'a str,
    pub source_record_id: Option<&'a str>,
    pub source_url: &'a str,
    pub raw_sha256: Option<&'a str>,
    pub raw_storage_key: Option<&'a str>,
    pub parse_status: &'a str,
    pub parse_error: Option<&'a str>,
    pub source_run_id: Option<uuid::Uuid>,
}

#[derive(Debug, Clone)]
pub struct OrganizationInput<'a> {
    pub canonical_name: &'a str,
    pub organization_type: &'a str,
    pub description: Option<&'a str>,
    pub website_url: Option<&'a str>,
}

#[derive(Debug, Clone)]
pub struct DisclosureHoldingInput<'a> {
    pub document_id: i64,
    pub bioguide_id: Option<&'a str>,
    pub owner_type: &'a str,
    pub asset_name: &'a str,
    pub ticker: Option<&'a str>,
    pub organization_id: Option<i64>,
    pub value_min: Option<f64>,
    pub value_max: Option<f64>,
    pub income_min: Option<f64>,
    pub income_max: Option<f64>,
    pub as_of_date: Option<NaiveDate>,
    pub raw_json: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct DisclosureTransactionInput<'a> {
    pub document_id: i64,
    pub bioguide_id: Option<&'a str>,
    pub owner_type: &'a str,
    pub asset_name: &'a str,
    pub ticker: Option<&'a str>,
    pub organization_id: Option<i64>,
    pub transaction_type: &'a str,
    pub amount_min: Option<f64>,
    pub amount_max: Option<f64>,
    pub transaction_date: Option<NaiveDate>,
    pub disclosure_date: Option<NaiveDate>,
    pub filing_url: Option<&'a str>,
    pub raw_json: serde_json::Value,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OrganizationRow {
    pub organization_id: i64,
    pub canonical_name: String,
    pub organization_type: String,
    pub description: Option<String>,
    pub website_url: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OrganizationIdentifierRow {
    pub scheme: String,
    pub value: String,
    pub source: String,
}

#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct DisclosureDocumentRow {
    pub document_id: i64,
    pub chamber: String,
    pub report_type: String,
    pub filing_date: Option<NaiveDate>,
    pub reporting_period_start: Option<NaiveDate>,
    pub reporting_period_end: Option<NaiveDate>,
    pub source: String,
    pub source_record_id: Option<String>,
    pub source_url: String,
    pub parse_status: String,
    pub parse_error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct DisclosureHoldingRow {
    pub document_id: i64,
    pub owner_type: String,
    pub asset_name: String,
    pub ticker: Option<String>,
    pub organization_id: Option<i64>,
    pub value_min: Option<f64>,
    pub value_max: Option<f64>,
    pub income_min: Option<f64>,
    pub income_max: Option<f64>,
    pub as_of_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct DisclosureTransactionRow {
    pub document_id: i64,
    pub owner_type: String,
    pub asset_name: String,
    pub ticker: Option<String>,
    pub organization_id: Option<i64>,
    pub transaction_type: String,
    pub amount_min: Option<f64>,
    pub amount_max: Option<f64>,
    pub transaction_date: Option<NaiveDate>,
    pub disclosure_date: Option<NaiveDate>,
    pub filing_url: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RelationshipEvidenceRow {
    pub relationship_id: i64,
    pub subject_key: String,
    pub object_key: String,
    pub relation_type: String,
    pub evidence_tier: String,
    pub confidence: String,
    pub source: String,
    pub source_record_id: Option<String>,
    pub source_url: Option<String>,
    pub observed_at: Option<NaiveDate>,
    pub amount_min: Option<f64>,
    pub amount_max: Option<f64>,
    pub details: serde_json::Value,
}

impl Repository {
    pub async fn upsert_disclosure_holding(
        &self,
        input: &DisclosureHoldingInput<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO disclosure_holdings
               (document_id, bioguide_id, owner_type, asset_name, ticker, organization_id,
                value_min, value_max, income_min, income_max, as_of_date, raw_json)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             ON CONFLICT (document_id, owner_type, asset_name, ticker) DO UPDATE SET
               organization_id = COALESCE(EXCLUDED.organization_id, disclosure_holdings.organization_id),
               value_min = EXCLUDED.value_min, value_max = EXCLUDED.value_max,
               income_min = EXCLUDED.income_min, income_max = EXCLUDED.income_max,
               as_of_date = EXCLUDED.as_of_date, raw_json = EXCLUDED.raw_json",
        )
        .bind(input.document_id)
        .bind(input.bioguide_id)
        .bind(input.owner_type)
        .bind(input.asset_name)
        .bind(input.ticker)
        .bind(input.organization_id)
        .bind(input.value_min)
        .bind(input.value_max)
        .bind(input.income_min)
        .bind(input.income_max)
        .bind(input.as_of_date)
        .bind(&input.raw_json)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    pub async fn upsert_disclosure_transaction(
        &self,
        input: &DisclosureTransactionInput<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO disclosure_transactions
               (document_id, bioguide_id, owner_type, asset_name, ticker, organization_id,
                transaction_type, amount_min, amount_max, transaction_date, disclosure_date,
                filing_url, raw_json)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT DO NOTHING",
        )
        .bind(input.document_id)
        .bind(input.bioguide_id)
        .bind(input.owner_type)
        .bind(input.asset_name)
        .bind(input.ticker)
        .bind(input.organization_id)
        .bind(input.transaction_type)
        .bind(input.amount_min)
        .bind(input.amount_max)
        .bind(input.transaction_date)
        .bind(input.disclosure_date)
        .bind(input.filing_url)
        .bind(&input.raw_json)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    /// Rebuild evidence edges from normalized source tables.
    ///
    /// This deliberately records the source row and URL on every edge. The
    /// derivation is repeatable and never treats a missing source row as a
    /// negative finding.
    pub async fn refresh_relationship_evidence(
        &self,
        source_run_id: uuid::Uuid,
    ) -> Result<(i64, i64), sqlx::Error> {
        let mut tx = self.pool().begin().await?;
        let mut seen = 0i64;
        let mut written = 0i64;

        let organization_queries = [
            r#"INSERT INTO organizations (canonical_name, organization_type)
               SELECT DISTINCT name,
                      CASE
                        WHEN lower(coalesce(committee_type_full, '')) LIKE '%super pac%' THEN 'super_pac'
                        ELSE 'pac'
                      END
               FROM fec_committees
               WHERE name <> ''
               ON CONFLICT (canonical_name, organization_type) DO UPDATE SET updated_at = now()"#,
            r#"INSERT INTO organizations (canonical_name, organization_type, description, website_url)
               SELECT DISTINCT name, 'lobbying_client', NULL, NULL
               FROM lobbying_clients WHERE name <> ''
               ON CONFLICT (canonical_name, organization_type) DO UPDATE SET updated_at = now()"#,
            r#"INSERT INTO organizations (canonical_name, organization_type, description, website_url)
               SELECT name, 'lobbying_registrant', max(description), NULL
               FROM lobbying_registrants WHERE name <> ''
               GROUP BY name
               ON CONFLICT (canonical_name, organization_type) DO UPDATE SET updated_at = now()"#,
            r#"INSERT INTO organizations (canonical_name, organization_type)
               SELECT DISTINCT COALESCE(NULLIF(asset_name, ''), ticker), 'company'
               FROM stock_trades
               WHERE ticker IS NOT NULL AND COALESCE(NULLIF(asset_name, ''), ticker) IS NOT NULL
               ON CONFLICT (canonical_name, organization_type) DO UPDATE SET updated_at = now()"#,
            r#"INSERT INTO organizations (canonical_name, organization_type)
               SELECT DISTINCT COALESCE(NULLIF(asset_name, ''), ticker), 'company'
               FROM disclosure_transactions
               WHERE ticker IS NOT NULL AND COALESCE(NULLIF(asset_name, ''), ticker) IS NOT NULL
               ON CONFLICT (canonical_name, organization_type) DO UPDATE SET updated_at = now()"#,
        ];
        for query in organization_queries {
            let result = sqlx::query(query).execute(&mut *tx).await?;
            written += result.rows_affected() as i64;
        }

        let identifier_queries = [
            r#"INSERT INTO organization_identifiers (organization_id, scheme, value, source, source_run_id)
               SELECT o.organization_id, 'fec', fc.committee_id, 'openfec', $1
               FROM fec_committees fc
               JOIN organizations o ON o.canonical_name = fc.name
                 AND o.organization_type = CASE
                   WHEN lower(coalesce(fc.committee_type_full, '')) LIKE '%super pac%'
                     THEN 'super_pac'
                   ELSE 'pac'
                 END
               ON CONFLICT (scheme, value) DO UPDATE SET source = EXCLUDED.source, source_run_id = EXCLUDED.source_run_id"#,
            r#"INSERT INTO organization_identifiers (organization_id, scheme, value, source, source_run_id)
               SELECT o.organization_id, 'lda_client', lc.id::text, 'lda', $1
               FROM lobbying_clients lc
               JOIN organizations o ON o.canonical_name = lc.name
                 AND o.organization_type = 'lobbying_client'
               ON CONFLICT (scheme, value) DO UPDATE SET source = EXCLUDED.source, source_run_id = EXCLUDED.source_run_id"#,
            r#"INSERT INTO organization_identifiers (organization_id, scheme, value, source, source_run_id)
               SELECT o.organization_id, 'lda_registrant', lr.id::text, 'lda', $1
               FROM lobbying_registrants lr
               JOIN organizations o ON o.canonical_name = lr.name
                 AND o.organization_type = 'lobbying_registrant'
               ON CONFLICT (scheme, value) DO UPDATE SET source = EXCLUDED.source, source_run_id = EXCLUDED.source_run_id"#,
            r#"INSERT INTO organization_identifiers (organization_id, scheme, value, source, source_run_id)
               SELECT DISTINCT ON (st.ticker) o.organization_id, 'ticker', st.ticker, st.source, $1
               FROM stock_trades st
               JOIN organizations o ON o.canonical_name = COALESCE(NULLIF(st.asset_name, ''), st.ticker)
                 AND o.organization_type = 'company'
               WHERE st.ticker IS NOT NULL
               ORDER BY st.ticker, st.trade_id DESC
               ON CONFLICT (scheme, value) DO UPDATE SET source = EXCLUDED.source, source_run_id = EXCLUDED.source_run_id"#,
            r#"INSERT INTO organization_identifiers (organization_id, scheme, value, source, source_run_id)
               SELECT DISTINCT ON (dt.ticker) o.organization_id, 'ticker', dt.ticker, 'house_disclosures', $1
               FROM disclosure_transactions dt
               JOIN organizations o ON o.canonical_name = COALESCE(NULLIF(dt.asset_name, ''), dt.ticker)
                 AND o.organization_type = 'company'
               WHERE dt.ticker IS NOT NULL
               ORDER BY dt.ticker, dt.transaction_id DESC
               ON CONFLICT (scheme, value) DO UPDATE SET source = EXCLUDED.source, source_run_id = EXCLUDED.source_run_id"#,
        ];
        for query in identifier_queries {
            let result = sqlx::query(query)
                .bind(source_run_id)
                .execute(&mut *tx)
                .await?;
            written += result.rows_affected() as i64;
        }

        let relationship_queries = [
            r#"INSERT INTO relationship_evidence
                 (subject_key, object_key, relation_type, evidence_tier, confidence, source,
                  source_record_id, source_url, observed_at, amount_min, amount_max, details, source_run_id)
               SELECT 'member:' || ft.bioguide_id, 'organization:' || o.organization_id,
                      'campaign_contribution', 'direct', 'verified', 'openfec', ft.transaction_id,
                      ft.source_url, ft.transaction_date, ft.amount, ft.amount,
                      jsonb_build_object('committee_id', ft.committee_id, 'cycle', ft.cycle), $1
               FROM fec_transactions ft
               JOIN organization_identifiers oi ON oi.scheme = 'fec' AND oi.value = ft.committee_id
               JOIN organizations o ON o.organization_id = oi.organization_id
               WHERE ft.bioguide_id IS NOT NULL AND ft.committee_id IS NOT NULL
               ON CONFLICT (subject_key, object_key, relation_type, source, source_record_id)
               DO UPDATE SET amount_min = EXCLUDED.amount_min, amount_max = EXCLUDED.amount_max,
                             source_url = EXCLUDED.source_url, source_run_id = EXCLUDED.source_run_id"#,
            r#"INSERT INTO relationship_evidence
                 (subject_key, object_key, relation_type, evidence_tier, confidence, source,
                  source_record_id, source_url, observed_at, amount_min, amount_max, details, source_run_id)
               SELECT 'member:' || st.bioguide_id, 'organization:' || o.organization_id,
                      'disclosed_trade', 'direct', 'verified', st.source, st.trade_id,
                      st.filing_url, st.transaction_date, st.amount_min, st.amount_max,
                      jsonb_build_object('ticker', st.ticker, 'transaction_type', st.tx_type), $1
               FROM stock_trades st
               JOIN organization_identifiers oi ON oi.scheme = 'ticker' AND oi.value = st.ticker
               JOIN organizations o ON o.organization_id = oi.organization_id
               WHERE st.bioguide_id IS NOT NULL AND st.ticker IS NOT NULL
               ON CONFLICT (subject_key, object_key, relation_type, source, source_record_id)
               DO UPDATE SET source_url = EXCLUDED.source_url, source_run_id = EXCLUDED.source_run_id"#,
            r#"INSERT INTO relationship_evidence
                 (subject_key, object_key, relation_type, evidence_tier, confidence, source,
                  source_record_id, source_url, observed_at, amount_min, amount_max, details, source_run_id)
               SELECT 'member:' || dt.bioguide_id, 'organization:' || o.organization_id,
                      'disclosed_trade', 'direct', 'verified', 'house_disclosures',
                      dt.document_id::text || ':' || dt.transaction_id::text, dt.filing_url,
                      dt.transaction_date, dt.amount_min, dt.amount_max,
                      jsonb_build_object('ticker', dt.ticker, 'transaction_type', dt.transaction_type,
                                         'owner_type', dt.owner_type), $1
               FROM disclosure_transactions dt
               JOIN organization_identifiers oi ON oi.scheme = 'ticker' AND oi.value = dt.ticker
               JOIN organizations o ON o.organization_id = oi.organization_id
               WHERE dt.bioguide_id IS NOT NULL AND dt.ticker IS NOT NULL
               ON CONFLICT (subject_key, object_key, relation_type, source, source_record_id)
               DO UPDATE SET source_url = EXCLUDED.source_url, source_run_id = EXCLUDED.source_run_id"#,
            r#"INSERT INTO relationship_evidence
                 (subject_key, object_key, relation_type, evidence_tier, confidence, source,
                  source_record_id, details, source_run_id)
               SELECT 'member:' || cm.bioguide_id, 'committee:' || cm.committee_id,
                      'committee_membership', 'direct', 'verified', 'unitedstates_legislators',
                      cm.id::text, jsonb_build_object('congress', cm.congress, 'title', cm.title), $1
               FROM committee_memberships cm
               WHERE cm.bioguide_id IS NOT NULL
               ON CONFLICT (subject_key, object_key, relation_type, source, source_record_id)
               DO UPDATE SET details = EXCLUDED.details, source_run_id = EXCLUDED.source_run_id"#,
            r#"INSERT INTO relationship_evidence
                 (subject_key, object_key, relation_type, evidence_tier, confidence, source,
                  source_record_id, observed_at, details, source_run_id)
               SELECT 'member:' || bs.bioguide_id, 'bill:' || bs.bill_id,
                      CASE WHEN bs.sponsor_type = 'sponsor' THEN 'sponsored_bill' ELSE 'cosponsored_bill' END,
                      'direct', 'verified', 'congress_gov', bs.id::text, bs.sponsorship_date,
                      jsonb_build_object('original_cosponsor', bs.is_original_cosponsor), $1
               FROM bill_sponsors bs
               WHERE bs.bioguide_id IS NOT NULL
               ON CONFLICT (subject_key, object_key, relation_type, source, source_record_id)
               DO UPDATE SET observed_at = EXCLUDED.observed_at, source_run_id = EXCLUDED.source_run_id"#,
            r#"INSERT INTO relationship_evidence
                 (subject_key, object_key, relation_type, evidence_tier, confidence, source,
                  source_record_id, details, source_run_id)
               SELECT 'committee:' || c.committee_id, 'bill:' || b.bill_id,
                      'bill_referral', 'derived', 'high', 'congress_gov', b.bill_id || ':' || c.committee_id,
                      jsonb_build_object('congress', b.congress), $1
               FROM bills b
               JOIN committees c ON c.committee_id = ANY(b.committee_referrals)
               ON CONFLICT (subject_key, object_key, relation_type, source, source_record_id)
               DO UPDATE SET details = EXCLUDED.details, source_run_id = EXCLUDED.source_run_id"#,
        ];
        for query in relationship_queries {
            let result = sqlx::query(query)
                .bind(source_run_id)
                .execute(&mut *tx)
                .await?;
            seen += result.rows_affected() as i64;
            written += result.rows_affected() as i64;
        }

        tx.commit().await?;
        Ok((seen, written))
    }
    pub async fn list_disclosure_documents(
        &self,
        bioguide_id: &str,
    ) -> Result<Vec<DisclosureDocumentRow>, sqlx::Error> {
        sqlx::query_as(
            "SELECT document_id, chamber, report_type, filing_date, reporting_period_start,
                    reporting_period_end, source, source_record_id, source_url, parse_status,
                    parse_error
             FROM disclosure_documents
             WHERE bioguide_id = $1
             ORDER BY filing_date DESC NULLS LAST, document_id DESC",
        )
        .bind(bioguide_id)
        .fetch_all(self.pool())
        .await
    }

    pub async fn list_disclosure_holdings(
        &self,
        bioguide_id: &str,
    ) -> Result<Vec<DisclosureHoldingRow>, sqlx::Error> {
        sqlx::query_as(
            "SELECT h.document_id, h.owner_type, h.asset_name, h.ticker, h.organization_id,
                    h.value_min::float8 AS value_min, h.value_max::float8 AS value_max,
                    h.income_min::float8 AS income_min, h.income_max::float8 AS income_max,
                    h.as_of_date
             FROM disclosure_holdings h
             JOIN disclosure_documents d ON d.document_id = h.document_id
             WHERE d.bioguide_id = $1
             ORDER BY h.as_of_date DESC NULLS LAST, h.holding_id DESC",
        )
        .bind(bioguide_id)
        .fetch_all(self.pool())
        .await
    }

    pub async fn list_disclosure_transactions(
        &self,
        bioguide_id: &str,
    ) -> Result<Vec<DisclosureTransactionRow>, sqlx::Error> {
        sqlx::query_as(
            "SELECT t.document_id, t.owner_type, t.asset_name, t.ticker, t.organization_id,
                    t.transaction_type, t.amount_min::float8 AS amount_min,
                    t.amount_max::float8 AS amount_max, t.transaction_date,
                    t.disclosure_date, t.filing_url
             FROM disclosure_transactions t
             JOIN disclosure_documents d ON d.document_id = t.document_id
             WHERE d.bioguide_id = $1
             ORDER BY t.transaction_date DESC NULLS LAST, t.transaction_id DESC",
        )
        .bind(bioguide_id)
        .fetch_all(self.pool())
        .await
    }

    pub async fn upsert_organization(
        &self,
        organization: &OrganizationInput<'_>,
    ) -> Result<i64, sqlx::Error> {
        let row: (i64,) = sqlx::query_as(
            "INSERT INTO organizations (canonical_name, organization_type, description, website_url)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (canonical_name, organization_type) DO UPDATE SET
               description = COALESCE(EXCLUDED.description, organizations.description),
               website_url = COALESCE(EXCLUDED.website_url, organizations.website_url),
               updated_at = now()
             RETURNING organization_id",
        )
        .bind(organization.canonical_name)
        .bind(organization.organization_type)
        .bind(organization.description)
        .bind(organization.website_url)
        .fetch_one(self.pool())
        .await?;
        Ok(row.0)
    }

    pub async fn upsert_organization_identifier(
        &self,
        organization_id: i64,
        scheme: &str,
        value: &str,
        source: &str,
        source_run_id: Option<uuid::Uuid>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO organization_identifiers (organization_id, scheme, value, source, source_run_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (organization_id, scheme, value) DO UPDATE SET
               source = EXCLUDED.source,
               source_run_id = EXCLUDED.source_run_id",
        )
        .bind(organization_id)
        .bind(scheme)
        .bind(value)
        .bind(source)
        .bind(source_run_id)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    pub async fn upsert_disclosure_document(
        &self,
        document: &DisclosureDocumentInput<'_>,
    ) -> Result<i64, sqlx::Error> {
        let row: (i64,) = sqlx::query_as(
            "INSERT INTO disclosure_documents
               (bioguide_id, chamber, report_type, filing_date, reporting_period_start,
                reporting_period_end, source, source_record_id, source_url, raw_sha256,
                raw_storage_key, parse_status, parse_error, source_run_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             ON CONFLICT (source_url) DO UPDATE SET
               parse_status = EXCLUDED.parse_status,
               parse_error = EXCLUDED.parse_error,
               raw_sha256 = EXCLUDED.raw_sha256,
               raw_storage_key = EXCLUDED.raw_storage_key,
               source_run_id = EXCLUDED.source_run_id
             RETURNING document_id",
        )
        .bind(document.bioguide_id)
        .bind(document.chamber)
        .bind(document.report_type)
        .bind(document.filing_date)
        .bind(document.reporting_period_start)
        .bind(document.reporting_period_end)
        .bind(document.source)
        .bind(document.source_record_id)
        .bind(document.source_url)
        .bind(document.raw_sha256)
        .bind(document.raw_storage_key)
        .bind(document.parse_status)
        .bind(document.parse_error)
        .bind(document.source_run_id)
        .fetch_one(self.pool())
        .await?;
        Ok(row.0)
    }

    pub async fn get_organization(
        &self,
        organization_id: i64,
    ) -> Result<Option<OrganizationRow>, sqlx::Error> {
        sqlx::query_as(
            "SELECT organization_id, canonical_name, organization_type, description, website_url
             FROM organizations WHERE organization_id = $1",
        )
        .bind(organization_id)
        .fetch_optional(self.pool())
        .await
    }

    pub async fn get_organization_identifiers(
        &self,
        organization_id: i64,
    ) -> Result<Vec<OrganizationIdentifierRow>, sqlx::Error> {
        sqlx::query_as(
            "SELECT scheme, value, source FROM organization_identifiers
             WHERE organization_id = $1 ORDER BY scheme, value",
        )
        .bind(organization_id)
        .fetch_all(self.pool())
        .await
    }

    pub async fn list_relationships(
        &self,
        subject_key: Option<&str>,
        object_key: Option<&str>,
        relation_type: Option<&str>,
        limit: i64,
    ) -> Result<Vec<RelationshipEvidenceRow>, sqlx::Error> {
        sqlx::query_as(
            "SELECT relationship_id, subject_key, object_key, relation_type,
                    evidence_tier, confidence::text AS confidence, source,
                    source_record_id, source_url, observed_at,
                    amount_min::float8 AS amount_min, amount_max::float8 AS amount_max,
                    details
             FROM relationship_evidence
             WHERE ($1::text IS NULL OR subject_key = $1)
               AND ($2::text IS NULL OR object_key = $2)
               AND ($3::text IS NULL OR relation_type = $3)
             ORDER BY observed_at DESC NULLS LAST, relationship_id DESC
             LIMIT $4",
        )
        .bind(subject_key)
        .bind(object_key)
        .bind(relation_type)
        .bind(limit)
        .fetch_all(self.pool())
        .await
    }
}
