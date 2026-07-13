//! Automated ingestion for small official FEC supplemental CSV datasets.

use crate::fec_bulk::download::{
    download_content_addressed_as, probe_archive, DownloadedArchive, RemoteArchive,
};
use crate::fec_bulk::pipeline::{CycleStats, PipelineError};
use crate::fec_bulk::supplemental::{
    normalize_person_name, parse_independent_expenditures, parse_leadership_pacs,
    IndependentExpenditureRow, LeadershipPacRow,
};
use crate::repository::fec::{FecBulkImportRecord, FecBulkImportUpsert};
use crate::repository::Repository;
use sqlx::{Postgres, QueryBuilder};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

const INSERT_BATCH_SIZE: usize = 500;

#[derive(Debug, Clone)]
struct PreparedCsv {
    dataset_name: String,
    path: PathBuf,
    sha256: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct CandidateIdentity {
    candidate_id: String,
    bioguide_id: String,
    candidate_name: String,
}

#[derive(Debug, Clone)]
struct SponsorResolution {
    status: &'static str,
    candidate_id: Option<String>,
    bioguide_id: Option<String>,
}

pub async fn ingest_supplemental_sources(
    repo: &Repository,
    cycle: u32,
    source_run_id: uuid::Uuid,
    storage: &Path,
) -> Result<CycleStats, PipelineError> {
    let leadership_url =
        format!("https://www.fec.gov/files/bulk-downloads/data.fec.gov/leadership{cycle}.csv");
    let independent_url = format!(
        "https://www.fec.gov/files/bulk-downloads/{cycle}/independent_expenditure_{cycle}.csv"
    );
    let leadership = prepare_csv(
        repo,
        storage,
        cycle,
        &format!("leadership{cycle}"),
        &leadership_url,
        source_run_id,
    )
    .await?;
    let independent = prepare_csv(
        repo,
        storage,
        cycle,
        &format!("independent_expenditure_{cycle}"),
        &independent_url,
        source_run_id,
    )
    .await?;

    let leadership_bytes = read_payload(&leadership.path).await?;
    let independent_bytes = read_payload(&independent.path).await?;
    let (leadership_rows, leadership_skipped) = parse_leadership_pacs(&leadership_bytes);
    let (independent_rows, independent_skipped) =
        parse_independent_expenditures(&independent_bytes);
    let identities = candidate_identities(repo).await?;

    let leadership_written = replace_leadership_pacs(
        repo,
        cycle as i32,
        source_run_id,
        &leadership_rows,
        &identities,
    )
    .await?;
    let independent_written =
        replace_independent_expenditures(repo, cycle as i32, source_run_id, &independent_rows)
            .await?;

    repo.update_bulk_import_status(
        &leadership.dataset_name,
        &leadership.sha256,
        "canonicalized",
        leadership_rows.len() as i64 + leadership_skipped as i64,
        None,
    )
    .await?;
    repo.update_bulk_import_status(
        &independent.dataset_name,
        &independent.sha256,
        "canonicalized",
        independent_rows.len() as i64 + independent_skipped as i64,
        None,
    )
    .await?;

    Ok(CycleStats {
        rows_seen: (leadership_rows.len()
            + leadership_skipped
            + independent_rows.len()
            + independent_skipped) as i64,
        rows_written: leadership_written + independent_written,
        rows_skipped: (leadership_skipped + independent_skipped) as i64,
    })
}

async fn prepare_csv(
    repo: &Repository,
    storage: &Path,
    cycle: u32,
    dataset_name: &str,
    url: &str,
    source_run_id: uuid::Uuid,
) -> Result<PreparedCsv, PipelineError> {
    let remote = probe_archive(url).await?;
    if let Some(existing) = repo
        .latest_bulk_import(dataset_name)
        .await?
        .filter(|record| reusable(record, &remote))
    {
        repo.touch_bulk_import(dataset_name, &existing.sha256, source_run_id)
            .await?;
        return Ok(PreparedCsv {
            dataset_name: dataset_name.to_string(),
            path: PathBuf::from(existing.archive_path.unwrap_or_default()),
            sha256: existing.sha256,
        });
    }

    let downloaded =
        download_content_addressed_as(url, storage, cycle, dataset_name, &remote, "csv").await?;
    record_download(
        repo,
        cycle,
        dataset_name,
        url,
        source_run_id,
        &remote,
        &downloaded,
    )
    .await?;
    Ok(PreparedCsv {
        dataset_name: dataset_name.to_string(),
        path: downloaded.path,
        sha256: downloaded.sha256,
    })
}

fn reusable(record: &FecBulkImportRecord, remote: &RemoteArchive) -> bool {
    let Some(path) = record.archive_path.as_deref() else {
        return false;
    };
    if !Path::new(path).is_file() {
        return false;
    }
    (record.etag.is_some() && record.etag == remote.etag)
        || (record.source_modified_at.is_some()
            && record.source_modified_at == remote.last_modified
            && record
                .compressed_bytes
                .and_then(|value| u64::try_from(value).ok())
                == remote.content_length)
}

async fn record_download(
    repo: &Repository,
    cycle: u32,
    dataset_name: &str,
    url: &str,
    source_run_id: uuid::Uuid,
    remote: &RemoteArchive,
    downloaded: &DownloadedArchive,
) -> Result<(), sqlx::Error> {
    let archive_path = downloaded.path.to_string_lossy();
    repo.upsert_bulk_import(FecBulkImportUpsert {
        dataset_name,
        election_cycle: cycle as i32,
        source_url: url,
        sha256: &downloaded.sha256,
        compressed_bytes: downloaded.compressed_bytes as i64,
        source_modified_at: remote.last_modified,
        etag: remote.etag.as_deref(),
        archive_path: &archive_path,
        source_run_id,
    })
    .await
}

async fn read_payload(path: &Path) -> Result<Vec<u8>, PipelineError> {
    tokio::fs::read(path)
        .await
        .map_err(|source| PipelineError::Io {
            context: format!("reading {}", path.display()),
            source,
        })
}

async fn candidate_identities(repo: &Repository) -> Result<Vec<CandidateIdentity>, sqlx::Error> {
    sqlx::query_as(
        r#"SELECT candidate.candidate_id,
                  COALESCE(identifier.bioguide_id, candidate.bioguide_id) AS bioguide_id,
                  candidate.name AS candidate_name
           FROM fec_candidates candidate
           LEFT JOIN member_identifiers identifier
             ON identifier.scheme = 'fec'
            AND identifier.value = candidate.candidate_id
           WHERE COALESCE(identifier.bioguide_id, candidate.bioguide_id) IS NOT NULL"#,
    )
    .fetch_all(repo.pool())
    .await
}

fn resolve_sponsor(name: &str, identities: &[CandidateIdentity]) -> SponsorResolution {
    let sponsor = normalize_person_name(name);
    if sponsor.is_empty() {
        return SponsorResolution {
            status: "unresolved",
            candidate_id: None,
            bioguide_id: None,
        };
    }
    let mut matches = Vec::new();
    let mut seen = HashSet::new();
    for identity in identities {
        let candidate = normalize_person_name(&identity.candidate_name);
        if candidate.len() >= 8
            && (sponsor.contains(&candidate) || candidate.contains(&sponsor))
            && seen.insert(identity.bioguide_id.clone())
        {
            matches.push(identity);
        }
    }
    if matches.len() == 1 {
        return SponsorResolution {
            status: "resolved",
            candidate_id: Some(matches[0].candidate_id.clone()),
            bioguide_id: Some(matches[0].bioguide_id.clone()),
        };
    }
    SponsorResolution {
        status: if matches.is_empty() {
            "unresolved"
        } else {
            "ambiguous"
        },
        candidate_id: None,
        bioguide_id: None,
    }
}

async fn replace_leadership_pacs(
    repo: &Repository,
    cycle: i32,
    source_run_id: uuid::Uuid,
    rows: &[LeadershipPacRow],
    identities: &[CandidateIdentity],
) -> Result<i64, sqlx::Error> {
    let mut transaction = repo.pool().begin().await?;
    sqlx::query("DELETE FROM fec_leadership_pacs WHERE election_cycle = $1")
        .bind(cycle)
        .execute(&mut *transaction)
        .await?;
    let mut written = 0;
    for row in rows {
        let resolution = resolve_sponsor(&row.sponsor_name, identities);
        sqlx::query(
            r#"INSERT INTO fec_leadership_pacs
               (election_cycle, committee_id, committee_name, filing_url,
                sponsor_name, sponsor_candidate_id, sponsor_bioguide_id,
                sponsor_resolution_status, cash_on_hand, coverage_end_date,
                total_disbursements, total_receipts, raw_row, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)"#,
        )
        .bind(cycle)
        .bind(&row.committee_id)
        .bind(&row.committee_name)
        .bind(&row.filing_url)
        .bind(&row.sponsor_name)
        .bind(resolution.candidate_id)
        .bind(resolution.bioguide_id)
        .bind(resolution.status)
        .bind(row.cash_on_hand())
        .bind(row.coverage_end_date())
        .bind(row.total_disbursements())
        .bind(row.total_receipts())
        .bind(serde_json::to_value(row).unwrap_or_else(|_| serde_json::json!({})))
        .bind(source_run_id)
        .execute(&mut *transaction)
        .await?;
        written += 1;
    }
    transaction.commit().await?;
    Ok(written)
}

async fn replace_independent_expenditures(
    repo: &Repository,
    cycle: i32,
    source_run_id: uuid::Uuid,
    rows: &[IndependentExpenditureRow],
) -> Result<i64, sqlx::Error> {
    let mut transaction = repo.pool().begin().await?;
    sqlx::query("DELETE FROM fec_independent_expenditures WHERE election_cycle = $1")
        .bind(cycle)
        .execute(&mut *transaction)
        .await?;

    let mut written = 0;
    for batch in rows.chunks(INSERT_BATCH_SIZE) {
        let mut builder: QueryBuilder<Postgres> = QueryBuilder::new(
            r#"INSERT INTO fec_independent_expenditures
               (election_cycle, source_key, candidate_id, candidate_name,
                spender_id, spender_name, election_type, candidate_state,
                candidate_district, candidate_office, candidate_party, amount,
                expenditure_date, aggregate_amount, support_oppose, purpose,
                payee, file_number, amendment_indicator, transaction_id,
                image_number, receipt_date, previous_file_number,
                dissemination_date, dedupe_method, raw_row, source_run_id) "#,
        );
        builder.push_values(batch, |mut values, row| {
            let support_oppose = match row.sup_opp.trim() {
                "S" => "S",
                "O" => "O",
                _ => "U",
            };
            values
                .push_bind(cycle)
                .push_bind(row.source_key())
                .push_bind(&row.cand_id)
                .push_bind(&row.cand_name)
                .push_bind(&row.spe_id)
                .push_bind(&row.spe_nam)
                .push_bind(&row.ele_type)
                .push_bind(&row.can_office_state)
                .push_bind(&row.can_office_dis)
                .push_bind(&row.can_office)
                .push_bind(&row.cand_pty_aff)
                .push_bind(row.amount().unwrap_or_default())
                .push_bind(row.expenditure_date())
                .push_bind(row.aggregate_amount())
                .push_bind(support_oppose)
                .push_bind(&row.pur)
                .push_bind(&row.pay)
                .push_bind(row.file_number())
                .push_bind(&row.amndt_ind)
                .push_bind(&row.tran_id)
                .push_bind(&row.image_num)
                .push_bind(row.receipt_date())
                .push_bind(row.previous_file_number())
                .push_bind(row.dissemination_date())
                .push_bind(if row.tran_id.trim().is_empty() {
                    "fingerprint"
                } else {
                    "transaction_id"
                })
                .push_bind(serde_json::to_value(row).unwrap_or_else(|_| serde_json::json!({})))
                .push_bind(source_run_id);
        });
        written += builder
            .build()
            .execute(&mut *transaction)
            .await?
            .rows_affected() as i64;
    }

    sync_independent_expenditure_transactions(&mut transaction, cycle, source_run_id).await?;
    crate::fec_bulk::rankings::refresh_funding_mv(&mut transaction).await?;
    sqlx::query("REFRESH MATERIALIZED VIEW influence_network_member_mv")
        .execute(&mut *transaction)
        .await?;
    sqlx::query("SELECT refresh_fec_campaign_finance_summary($1)")
        .bind(cycle)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(written)
}

async fn sync_independent_expenditure_transactions(
    transaction: &mut sqlx::Transaction<'_, Postgres>,
    cycle: i32,
    source_run_id: uuid::Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM fec_transactions
         WHERE cycle = $1
           AND raw_json ->> 'source_dataset' = 'fec_bulk_independent_expenditure'",
    )
    .bind(cycle)
    .execute(&mut **transaction)
    .await?;
    sqlx::query(
        r#"INSERT INTO fec_transactions
           (transaction_id, transaction_type, committee_id, candidate_id,
            bioguide_id, contributor_name, contributor_committee_id,
            recipient_name, amount, transaction_date, cycle,
            support_oppose_indicator, purpose, source_url, raw_json, source_run_id)
           SELECT
             'fec-ie:' || ie.election_cycle::text || ':' || ie.source_key,
             'independent_expenditure'::fec_transaction_type,
             CASE WHEN committee.committee_id IS NOT NULL THEN ie.spender_id END,
             CASE WHEN candidate.candidate_id IS NOT NULL THEN ie.candidate_id END,
             COALESCE(identifier.bioguide_id, candidate.bioguide_id),
             ie.spender_name,
             ie.spender_id,
             ie.candidate_name,
             ie.amount,
             COALESCE(ie.expenditure_date, ie.dissemination_date),
             ie.election_cycle,
             ie.support_oppose,
             ie.purpose,
             CASE WHEN ie.image_number IS NOT NULL AND ie.image_number <> ''
                  THEN 'https://docquery.fec.gov/cgi-bin/fecimg/?' || ie.image_number
             END,
             ie.raw_row || jsonb_build_object(
                 'source_dataset', 'fec_bulk_independent_expenditure',
                 'canonical_source_key', ie.source_key,
                 'spender_resolution_status',
                    CASE WHEN committee.committee_id IS NULL THEN 'unresolved' ELSE 'resolved' END,
                 'candidate_resolution_status',
                    CASE WHEN candidate.candidate_id IS NULL THEN 'unresolved' ELSE 'resolved' END
             ),
             $2
           FROM fec_independent_expenditures ie
           LEFT JOIN fec_committees committee ON committee.committee_id = ie.spender_id
           LEFT JOIN fec_candidates candidate ON candidate.candidate_id = ie.candidate_id
           LEFT JOIN member_identifiers identifier
             ON identifier.scheme = 'fec' AND identifier.value = ie.candidate_id
           WHERE ie.election_cycle = $1"#,
    )
    .bind(cycle)
    .bind(source_run_id)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sponsor_resolution_requires_one_official_candidate_match() {
        let identities = vec![CandidateIdentity {
            candidate_id: "H0IA01174".to_string(),
            bioguide_id: "H001091".to_string(),
            candidate_name: "HINSON, ASHLEY".to_string(),
        }];
        let resolution = resolve_sponsor("ARENHOLZ, ASHLEY HINSON", &identities);
        assert_eq!(resolution.status, "resolved");
        assert_eq!(resolution.bioguide_id.as_deref(), Some("H001091"));
    }

    #[test]
    fn duplicate_candidate_name_matches_remain_ambiguous() {
        let identities = vec![
            CandidateIdentity {
                candidate_id: "H0ZZ00001".to_string(),
                bioguide_id: "A000001".to_string(),
                candidate_name: "SMITH, JOHN".to_string(),
            },
            CandidateIdentity {
                candidate_id: "S0ZZ00002".to_string(),
                bioguide_id: "B000002".to_string(),
                candidate_name: "SMITH, JOHN".to_string(),
            },
        ];
        assert_eq!(
            resolve_sponsor("SMITH, JOHN", &identities).status,
            "ambiguous"
        );
    }
}
