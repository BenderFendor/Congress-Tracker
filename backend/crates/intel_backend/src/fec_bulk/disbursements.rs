//! Bounded, restartable Schedule B operating-disbursement ingestion.

use crate::fec_bulk::pipeline::{CycleStats, PipelineError};
use crate::fec_bulk::stream::spawn_zip_batches;
use crate::fec_bulk::{is_plausible_fec_date, parse_amount, parse_fec_date, parse_int};
use crate::repository::Repository;
use chrono::NaiveDate;
use std::path::PathBuf;

// 29 bind values per row; 2,000 stays below PostgreSQL's 65,535-parameter cap.
const STREAM_BATCH_SIZE: usize = 2_000;

#[derive(Debug, Clone)]
pub struct OperatingDisbursementRow {
    pub committee_id: String,
    pub amendment_indicator: Option<String>,
    pub report_year: Option<i64>,
    pub report_type: Option<String>,
    pub image_number: Option<String>,
    pub line_number: Option<String>,
    pub form_type: Option<String>,
    pub schedule_type: Option<String>,
    pub recipient_name: String,
    pub city: Option<String>,
    pub state: Option<String>,
    pub zip_code: Option<String>,
    pub transaction_date: Option<NaiveDate>,
    pub amount: f64,
    pub primary_general: Option<String>,
    pub purpose: Option<String>,
    pub category_code: Option<String>,
    pub category_description: Option<String>,
    pub memo_code: Option<String>,
    pub memo_text: Option<String>,
    pub entity_type: Option<String>,
    pub sub_id: i64,
    pub file_number: Option<i64>,
    pub transaction_id: Option<String>,
    pub back_reference_id: Option<String>,
    pub raw_row: String,
}

fn optional(value: &str) -> Option<String> {
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_string())
}

pub fn parse_operating_disbursement(line: &str) -> Option<OperatingDisbursementRow> {
    let fields = line.split('|').collect::<Vec<_>>();
    if fields.len() < 25 {
        return None;
    }
    let committee_id = fields[0].trim();
    let recipient_name = fields[8].trim();
    let amount = parse_amount(fields[13])?;
    let sub_id = parse_int(fields[21])?;
    if committee_id.is_empty() || recipient_name.is_empty() {
        return None;
    }
    Some(OperatingDisbursementRow {
        committee_id: committee_id.to_string(),
        amendment_indicator: optional(fields[1]),
        report_year: parse_int(fields[2]),
        report_type: optional(fields[3]),
        image_number: optional(fields[4]),
        line_number: optional(fields[5]),
        form_type: optional(fields[6]),
        schedule_type: optional(fields[7]),
        recipient_name: recipient_name.to_string(),
        city: optional(fields[9]),
        state: optional(fields[10]),
        zip_code: optional(fields[11]),
        transaction_date: parse_fec_date(fields[12]),
        amount,
        primary_general: optional(fields[14]),
        purpose: optional(fields[15]),
        category_code: optional(fields[16]),
        category_description: optional(fields[17]),
        memo_code: optional(fields[18]),
        memo_text: optional(fields[19]),
        entity_type: optional(fields[20]),
        sub_id,
        file_number: parse_int(fields[22]),
        transaction_id: optional(fields[23]),
        back_reference_id: optional(fields[24]),
        raw_row: line.to_string(),
    })
}

pub async fn ingest(
    repo: &Repository,
    cycle: u32,
    source_run_id: uuid::Uuid,
    path: PathBuf,
    entry_name: String,
    source_sha256: String,
) -> Result<CycleStats, PipelineError> {
    let mut receiver = spawn_zip_batches(
        path,
        vec![entry_name],
        STREAM_BATCH_SIZE,
        false,
        parse_operating_disbursement,
        |_| true,
    );
    let mut stats = CycleStats::default();
    while let Some(batch) = receiver.recv().await {
        let batch = batch?;
        stats.rows_seen += batch.seen as i64;
        stats.rows_skipped += batch.skipped as i64;
        let mut rows = batch.rows;
        for row in &mut rows {
            if row
                .transaction_date
                .is_some_and(|date| !is_plausible_fec_date(date, cycle))
            {
                row.transaction_date = None;
            }
        }
        if !rows.is_empty() {
            stats.rows_written +=
                insert_batch(repo, cycle as i32, source_run_id, &source_sha256, &rows).await?;
        }
    }
    canonicalize(repo, cycle as i32, source_run_id).await?;
    Ok(stats)
}

async fn insert_batch(
    repo: &Repository,
    cycle: i32,
    source_run_id: uuid::Uuid,
    source_sha256: &str,
    rows: &[OperatingDisbursementRow],
) -> Result<i64, sqlx::Error> {
    let mut query = sqlx::QueryBuilder::new(
        r#"INSERT INTO fec_operating_disbursement_rows
           (election_cycle,committee_id,amendment_indicator,report_year,report_type,
            image_number,line_number,form_type,schedule_type,recipient_name,city,state,
            zip_code,transaction_date,amount,primary_general,purpose,category_code,
            category_description,memo_code,memo_text,entity_type,sub_id,file_number,
            transaction_id,back_reference_id,raw_row,source_sha256,source_run_id) "#,
    );
    query.push_values(rows, |mut values, row| {
        values
            .push_bind(cycle)
            .push_bind(&row.committee_id)
            .push_bind(&row.amendment_indicator)
            .push_bind(row.report_year)
            .push_bind(&row.report_type)
            .push_bind(&row.image_number)
            .push_bind(&row.line_number)
            .push_bind(&row.form_type)
            .push_bind(&row.schedule_type)
            .push_bind(&row.recipient_name)
            .push_bind(&row.city)
            .push_bind(&row.state)
            .push_bind(&row.zip_code)
            .push_bind(row.transaction_date)
            .push_bind(row.amount)
            .push_bind(&row.primary_general)
            .push_bind(&row.purpose)
            .push_bind(&row.category_code)
            .push_bind(&row.category_description)
            .push_bind(&row.memo_code)
            .push_bind(&row.memo_text)
            .push_bind(&row.entity_type)
            .push_bind(row.sub_id)
            .push_bind(row.file_number)
            .push_bind(&row.transaction_id)
            .push_bind(&row.back_reference_id)
            .push_bind(&row.raw_row)
            .push_bind(source_sha256)
            .push_bind(source_run_id);
    });
    query.push(
        " ON CONFLICT (election_cycle,sub_id) DO UPDATE SET \
         source_sha256=EXCLUDED.source_sha256,source_run_id=EXCLUDED.source_run_id,\
         raw_row=EXCLUDED.raw_row",
    );
    Ok(query.build().execute(repo.pool()).await?.rows_affected() as i64)
}

async fn canonicalize(
    repo: &Repository,
    cycle: i32,
    source_run_id: uuid::Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = repo.pool().begin().await?;
    sqlx::query("DELETE FROM fec_canonical_operating_disbursements WHERE election_cycle=$1")
        .bind(cycle)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        r#"INSERT INTO fec_canonical_operating_disbursements
           (election_cycle, committee_id, source_record_id, amendment_indicator, report_year,
            report_type, image_number, line_number, form_type, schedule_type, recipient_name,
            city, state, zip_code, transaction_date, amount, primary_general, purpose,
            category_code, category_description, memo_code, memo_text, entity_type, sub_id,
            file_number, transaction_id, back_reference_id, source_url, source_sha256,
            source_run_id)
           SELECT DISTINCT ON (committee_id, COALESCE(NULLIF(transaction_id,''), sub_id::text))
             election_cycle, committee_id, COALESCE(NULLIF(transaction_id,''), sub_id::text),
             amendment_indicator, report_year, report_type, image_number, line_number,
             form_type, schedule_type, recipient_name, city, state, zip_code, transaction_date,
             amount, primary_general, purpose, category_code, category_description, memo_code,
             memo_text, entity_type, sub_id, file_number, transaction_id, back_reference_id,
             CASE WHEN image_number IS NULL THEN 'https://www.fec.gov/data/disbursements/'
                  ELSE 'https://docquery.fec.gov/cgi-bin/fecimg/?' || image_number END,
             source_sha256, $2
           FROM fec_operating_disbursement_rows
           WHERE election_cycle=$1
           ORDER BY committee_id, COALESCE(NULLIF(transaction_id,''), sub_id::text),
                    file_number DESC NULLS LAST, sub_id DESC"#,
    )
    .bind(cycle)
    .bind(source_run_id)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        r#"INSERT INTO fec_disbursement_cycle_counts (election_cycle,item_count)
           SELECT $1,COUNT(*) FROM fec_canonical_operating_disbursements WHERE election_cycle=$1
           ON CONFLICT (election_cycle) DO UPDATE
           SET item_count=EXCLUDED.item_count,refreshed_at=now()"#,
    )
    .bind(cycle)
    .execute(&mut *tx)
    .await?;
    sqlx::query("SELECT refresh_fec_campaign_finance_summary($1)")
        .bind(cycle)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_official_25_column_schedule_b_shape() {
        let line = "C001|A|2024|M12|IMG|17|F3X|SB|ACME PRINTING|PHILADELPHIA|PA|19103|07042024|1250.50|P2024|PRINTING|001|Administrative|X|memo|ORG|12345|42|TX-1|BACK-1";
        let row = parse_operating_disbursement(line).expect("valid Schedule B row");
        assert_eq!(row.committee_id, "C001");
        assert_eq!(row.recipient_name, "ACME PRINTING");
        assert_eq!(row.amount, 1250.50);
        assert_eq!(row.transaction_date, NaiveDate::from_ymd_opt(2024, 7, 4));
        assert_eq!(row.transaction_id.as_deref(), Some("TX-1"));
    }

    #[test]
    fn rejects_malformed_amounts_instead_of_inventing_zero() {
        let line = "C001|A|2024|M12|IMG|17|F3X|SB|ACME|CITY|PA|19103|07042024|bad|P2024|PRINTING|001|Administrative|||ORG|12345|42|TX-1|";
        assert!(parse_operating_disbursement(line).is_none());
    }
}
