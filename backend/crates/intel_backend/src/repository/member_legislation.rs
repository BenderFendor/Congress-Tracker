use crate::repository::Repository;
use sqlx::{Postgres, QueryBuilder};

pub struct MemberLegislationBillWrite {
    pub congress: i32,
    pub bill_type: String,
    pub bill_number: i32,
    pub bill_id: String,
    pub title: String,
    pub introduced_date: Option<chrono::NaiveDate>,
    pub policy_area: Option<String>,
    pub latest_action_date: Option<chrono::NaiveDate>,
    pub latest_action_text: Option<String>,
    pub status: String,
    pub source_url: String,
    pub bioguide_id: String,
    pub sponsor_type: String,
}

pub struct MemberLegislationEvidenceWrite {
    pub bioguide_id: String,
    pub role: String,
    pub source_url: String,
    pub congress: i32,
    pub item_kind: String,
    pub item_type: Option<String>,
    pub item_number: Option<i32>,
    pub title: Option<String>,
    pub introduced_date: Option<chrono::NaiveDate>,
    pub latest_action_date: Option<chrono::NaiveDate>,
    pub latest_action_text: Option<String>,
    pub raw_item: serde_json::Value,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct MemberLegislationCoverageSummary {
    pub current_members: i64,
    pub coverage_rows: i64,
    pub loaded_rows: i64,
    pub reconciled_rows: i64,
    pub failed_rows: i64,
    pub running_rows: i64,
    pub rows_seen: i64,
    pub rows_written: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MemberLegislationCoverageProgress {
    pub advertised_count: Option<i64>,
    pub rows_seen: i64,
    pub rows_written: i64,
    pub duplicate_rows: i64,
    pub pages_fetched: i32,
}

impl MemberLegislationCoverageSummary {
    pub fn expected_rows(self) -> i64 {
        self.current_members.saturating_mul(2)
    }

    pub fn is_complete(self) -> bool {
        self.coverage_rows == self.expected_rows()
            && self.loaded_rows == self.expected_rows()
            && self.reconciled_rows == self.expected_rows()
            && self.failed_rows == 0
            && self.running_rows == 0
    }
}

impl Repository {
    pub async fn upsert_member_legislation_page(
        &self,
        source_run_id: uuid::Uuid,
        bills: &[MemberLegislationBillWrite],
        evidence: &[MemberLegislationEvidenceWrite],
    ) -> Result<(), sqlx::Error> {
        let mut transaction = self.pool().begin().await?;
        if !bills.is_empty() {
            let mut bill_query = QueryBuilder::<Postgres>::new(
                "INSERT INTO bills
                 (congress, bill_type, bill_number, bill_id, title,
                  introduced_date, origin_chamber, policy_area,
                  latest_action_date, latest_action_text, status, url, source_run_id) ",
            );
            bill_query.push_values(bills, |mut row, bill| {
                row.push_bind(bill.congress)
                    .push_bind(&bill.bill_type)
                    .push_bind(bill.bill_number)
                    .push_bind(&bill.bill_id)
                    .push_bind(&bill.title)
                    .push_bind(bill.introduced_date)
                    .push_bind(Option::<String>::None)
                    .push_bind(&bill.policy_area)
                    .push_bind(bill.latest_action_date)
                    .push_bind(&bill.latest_action_text)
                    .push_bind(&bill.status)
                    .push_bind(&bill.source_url)
                    .push_bind(source_run_id);
            });
            bill_query.push(
                " ON CONFLICT (congress, bill_type, bill_number) DO UPDATE SET
                   bill_id=EXCLUDED.bill_id,
                   title=CASE
                     WHEN EXCLUDED.title LIKE 'Title unavailable (%'
                       AND bills.title NOT LIKE 'Title unavailable (%'
                     THEN bills.title
                     ELSE EXCLUDED.title
                   END,
                   introduced_date=COALESCE(EXCLUDED.introduced_date, bills.introduced_date),
                   policy_area=COALESCE(EXCLUDED.policy_area, bills.policy_area),
                   latest_action_date=EXCLUDED.latest_action_date,
                   latest_action_text=EXCLUDED.latest_action_text,
                   status=EXCLUDED.status, url=COALESCE(EXCLUDED.url, bills.url),
                   source_run_id=EXCLUDED.source_run_id",
            );
            bill_query.build().execute(&mut *transaction).await?;

            let mut sponsor_query = QueryBuilder::<Postgres>::new(
                "INSERT INTO bill_sponsors
                 (bill_id, bioguide_id, sponsor_type, sponsorship_date,
                  is_original_cosponsor, source_run_id) ",
            );
            sponsor_query.push_values(bills, |mut row, bill| {
                row.push_bind(&bill.bill_id)
                    .push_bind(&bill.bioguide_id)
                    .push_bind(&bill.sponsor_type)
                    .push_bind(bill.introduced_date)
                    .push_bind(false)
                    .push_bind(source_run_id);
            });
            sponsor_query.push(
                " ON CONFLICT (bill_id, bioguide_id, sponsor_type) DO UPDATE SET
                   sponsorship_date=COALESCE(EXCLUDED.sponsorship_date,
                                               bill_sponsors.sponsorship_date),
                   is_original_cosponsor=EXCLUDED.is_original_cosponsor,
                   source_run_id=EXCLUDED.source_run_id",
            );
            sponsor_query.build().execute(&mut *transaction).await?;
        }

        if !evidence.is_empty() {
            let mut evidence_query = QueryBuilder::<Postgres>::new(
                "INSERT INTO member_legislation_items
                 (bioguide_id, role, source_url, congress, item_kind, item_type,
                  item_number, title, introduced_date, latest_action_date,
                  latest_action_text, raw_item, source_run_id) ",
            );
            evidence_query.push_values(evidence, |mut row, item| {
                row.push_bind(&item.bioguide_id)
                    .push_bind(&item.role)
                    .push_bind(&item.source_url)
                    .push_bind(item.congress)
                    .push_bind(&item.item_kind)
                    .push_bind(&item.item_type)
                    .push_bind(item.item_number)
                    .push_bind(&item.title)
                    .push_bind(item.introduced_date)
                    .push_bind(item.latest_action_date)
                    .push_bind(&item.latest_action_text)
                    .push_bind(&item.raw_item)
                    .push_bind(source_run_id);
            });
            evidence_query.push(
                " ON CONFLICT (bioguide_id, role, source_url) DO UPDATE SET
                   congress=EXCLUDED.congress, item_kind=EXCLUDED.item_kind,
                   item_type=EXCLUDED.item_type, item_number=EXCLUDED.item_number,
                   title=EXCLUDED.title, introduced_date=EXCLUDED.introduced_date,
                   latest_action_date=EXCLUDED.latest_action_date,
                   latest_action_text=EXCLUDED.latest_action_text,
                   raw_item=EXCLUDED.raw_item, source_run_id=EXCLUDED.source_run_id,
                   updated_at=now()",
            );
            evidence_query.build().execute(&mut *transaction).await?;
        }
        transaction.commit().await?;
        Ok(())
    }

    pub async fn fail_orphaned_member_legislation_runs(&self) -> Result<u64, sqlx::Error> {
        let mut transaction = self.pool().begin().await?;
        sqlx::query(
            "UPDATE member_legislation_coverage coverage
             SET status='failed', finished_at=now(),
                 error_message='superseded after the prior refresh lost its process owner'
             FROM source_runs runs
             WHERE coverage.source_run_id=runs.id
               AND coverage.status='running'
               AND runs.endpoint='/v3/member/{bioguide}/sponsored-and-cosponsored-legislation'",
        )
        .execute(&mut *transaction)
        .await?;
        let result = sqlx::query(
            "UPDATE source_runs runs
             SET status='failed', finished_at=now(),
                 rows_seen=COALESCE((
                   SELECT SUM(coverage.rows_seen)
                   FROM member_legislation_coverage coverage
                   WHERE coverage.source_run_id=runs.id
                 ),0),
                 rows_written=COALESCE((
                   SELECT SUM(coverage.rows_written)
                   FROM member_legislation_coverage coverage
                   WHERE coverage.source_run_id=runs.id
                 ),0),
                 error_message='superseded after the prior refresh lost its process owner'
             WHERE runs.status='running'
               AND runs.endpoint='/v3/member/{bioguide}/sponsored-and-cosponsored-legislation'",
        )
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(result.rows_affected())
    }

    pub async fn start_member_legislation_coverage(
        &self,
        source_run_id: uuid::Uuid,
        bioguide_id: &str,
        congress: i32,
        role: &str,
    ) -> Result<(), sqlx::Error> {
        let result = sqlx::query(
            "INSERT INTO member_legislation_coverage
             (source_run_id, bioguide_id, congress, role, status)
             VALUES ($1, $2, $3, $4, 'running')
             ON CONFLICT (source_run_id, bioguide_id, congress, role)
             DO UPDATE SET status='running', advertised_count=NULL,
               rows_seen=0, rows_written=0, duplicate_rows=0, pages_fetched=0,
               error_message=NULL, started_at=now(), finished_at=NULL
             WHERE member_legislation_coverage.status <> 'loaded'",
        )
        .bind(source_run_id)
        .bind(bioguide_id)
        .bind(congress)
        .bind(role)
        .execute(self.pool())
        .await?;
        if result.rows_affected() != 1 {
            return Err(sqlx::Error::RowNotFound);
        }
        Ok(())
    }

    pub async fn finish_member_legislation_coverage_loaded(
        &self,
        source_run_id: uuid::Uuid,
        bioguide_id: &str,
        congress: i32,
        role: &str,
        progress: MemberLegislationCoverageProgress,
    ) -> Result<(), sqlx::Error> {
        let result = sqlx::query(
            "UPDATE member_legislation_coverage
             SET status='loaded', advertised_count=$5, rows_seen=$6,
                 rows_written=$7, duplicate_rows=$8, pages_fetched=$9, finished_at=now()
             WHERE source_run_id=$1 AND bioguide_id=$2 AND congress=$3
               AND role=$4 AND status='running'",
        )
        .bind(source_run_id)
        .bind(bioguide_id)
        .bind(congress)
        .bind(role)
        .bind(progress.advertised_count)
        .bind(progress.rows_seen)
        .bind(progress.rows_written)
        .bind(progress.duplicate_rows)
        .bind(progress.pages_fetched)
        .execute(self.pool())
        .await?;
        if result.rows_affected() != 1 {
            return Err(sqlx::Error::RowNotFound);
        }
        Ok(())
    }

    pub async fn finish_member_legislation_coverage_failed(
        &self,
        source_run_id: uuid::Uuid,
        bioguide_id: &str,
        congress: i32,
        role: &str,
        progress: MemberLegislationCoverageProgress,
        error_message: &str,
    ) -> Result<(), sqlx::Error> {
        let result = sqlx::query(
            "UPDATE member_legislation_coverage
             SET status='failed', advertised_count=$5, rows_seen=$6,
                 rows_written=$7, duplicate_rows=$8, pages_fetched=$9, error_message=$10,
                 finished_at=now()
             WHERE source_run_id=$1 AND bioguide_id=$2 AND congress=$3
               AND role=$4 AND status='running'",
        )
        .bind(source_run_id)
        .bind(bioguide_id)
        .bind(congress)
        .bind(role)
        .bind(progress.advertised_count)
        .bind(progress.rows_seen)
        .bind(progress.rows_written)
        .bind(progress.duplicate_rows)
        .bind(progress.pages_fetched)
        .bind(error_message)
        .execute(self.pool())
        .await?;
        if result.rows_affected() != 1 {
            return Err(sqlx::Error::RowNotFound);
        }
        Ok(())
    }

    pub async fn member_legislation_coverage_summary(
        &self,
        source_run_id: uuid::Uuid,
    ) -> Result<MemberLegislationCoverageSummary, sqlx::Error> {
        let row: (i64, i64, i64, i64, i64, i64, i64, i64) = sqlx::query_as(
            "SELECT
               (SELECT COUNT(*) FROM members WHERE in_office=true)::bigint,
               COUNT(*)::bigint,
               COUNT(*) FILTER (WHERE status='loaded')::bigint,
               COUNT(*) FILTER (
                 WHERE status='loaded'
                   AND advertised_count=rows_seen
                   AND rows_seen=rows_written+duplicate_rows
               )::bigint,
               COUNT(*) FILTER (WHERE status='failed')::bigint,
               COUNT(*) FILTER (WHERE status='running')::bigint,
               COALESCE(SUM(rows_seen), 0)::bigint,
               COALESCE(SUM(rows_written), 0)::bigint
             FROM member_legislation_coverage WHERE source_run_id=$1",
        )
        .bind(source_run_id)
        .fetch_one(self.pool())
        .await?;
        Ok(MemberLegislationCoverageSummary {
            current_members: row.0,
            coverage_rows: row.1,
            loaded_rows: row.2,
            reconciled_rows: row.3,
            failed_rows: row.4,
            running_rows: row.5,
            rows_seen: row.6,
            rows_written: row.7,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::MemberLegislationCoverageSummary;

    fn complete_summary() -> MemberLegislationCoverageSummary {
        MemberLegislationCoverageSummary {
            current_members: 2,
            coverage_rows: 4,
            loaded_rows: 4,
            reconciled_rows: 4,
            failed_rows: 0,
            running_rows: 0,
            rows_seen: 12,
            rows_written: 12,
        }
    }

    #[test]
    fn terminal_coverage_requires_two_reconciled_roles_per_current_member() {
        assert!(complete_summary().is_complete());

        for incomplete in [
            MemberLegislationCoverageSummary {
                coverage_rows: 3,
                ..complete_summary()
            },
            MemberLegislationCoverageSummary {
                loaded_rows: 3,
                ..complete_summary()
            },
            MemberLegislationCoverageSummary {
                reconciled_rows: 3,
                ..complete_summary()
            },
            MemberLegislationCoverageSummary {
                failed_rows: 1,
                ..complete_summary()
            },
            MemberLegislationCoverageSummary {
                running_rows: 1,
                ..complete_summary()
            },
        ] {
            assert!(!incomplete.is_complete());
        }
    }
}
