//! Deterministic CLI ingest binary for the Congress data platform.
//!
//! Every subcommand connects to Postgres, runs migrations, starts a
//! `source_runs` row, processes data in batches of 500, then finishes
//! the source run with an accurate status and row counts.

use std::sync::Arc;
use std::{
    collections::HashMap,
    fs::File,
    io::{BufRead, BufReader},
    process::Command as ProcessCommand,
};

use chrono::NaiveDate;
use clap::{Parser, Subcommand};
use intel_backend::{
    cache::CacheLayer,
    db::Db,
    normalize::{normalize_chamber, normalize_party, normalize_state, normalize_vote_position},
    repository::{
        bills::{BillAmendmentUpsert, BillSponsorUpsert, BillUpsert},
        entity_resolution::EntityResolutionQueueInput,
        fec::{FecCandidateUpsert, FecCommitteeUpsert, FecTransactionUpsert},
        influence::{InfluenceNetworkCommitteeUpsert, InfluenceNetworkUpsert},
        lobbying::{
            LobbyingActivityUpsert, LobbyingFilingUpsert, LobbyingLobbyistUpsert,
            LobbyingRegistrantUpsert,
        },
        members::{CommitteeAssignmentUpsert, MemberTermUpsert, MemberUpsert},
        relationships::RelationshipEvidenceInsert,
        votes::RollCallVoteUpsert,
        Repository,
    },
    schema::{
        self, SOURCE_CONGRESS_GOV, SOURCE_LDA, SOURCE_MANUAL, SOURCE_OPENFEC,
        SOURCE_RELATIONSHIP_DERIVATION, SOURCE_UNITEDSTATES, SOURCE_VOTEVIEW,
    },
    senate_efd,
};
use sha2::{Digest, Sha256};
use tracing::{info, warn};

// ── CLI definition ─────────────────────────────────────────────────────────

#[derive(Parser)]
#[command(
    name = "ingest",
    about = "Deterministic data ingestion for the Congress intelligence backend"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Refresh every broadly available member-profile evidence source.
    ProfileEvidenceAll {
        #[arg(long, default_value_t = 119)]
        congress: u32,
        #[arg(long, default_value_t = 2026)]
        cycle: u32,
    },
    /// Seed the database with influence network definitions
    InfluenceSeeds,
    /// Ingest members from unitedstates/congress-legislators
    Members {
        #[arg(long)]
        current_only: bool,
        #[arg(long, default_value = "100")]
        limit: u32,
    },
    /// Ingest congressional members from Congress.gov
    CongressMembers {
        #[arg(long, default_value = "100")]
        limit: u32,
    },
    /// Ingest bills from Congress.gov
    CongressBills {
        #[arg(long)]
        congress: u32,
        #[arg(long, default_value = "50")]
        limit: u32,
    },
    /// Ingest votes from Congress.gov
    CongressVotes {
        #[arg(long)]
        congress: u32,
        #[arg(long)]
        chamber: String,
        #[arg(long, default_value = "50")]
        limit: u32,
    },
    /// Ingest FEC candidates
    FecCandidates {
        #[arg(long)]
        cycle: u32,
        #[arg(long, default_value = "100")]
        limit: u32,
    },
    /// Ingest FEC committees
    FecCommittees {
        #[arg(long)]
        q: String,
        #[arg(long, default_value = "20")]
        limit: u32,
    },
    /// Ingest FEC transactions (receipts)
    FecTransactions {
        #[arg(long)]
        cycle: u32,
        #[arg(long)]
        committee_id: String,
        #[arg(long, default_value = "100")]
        limit: u32,
    },
    /// Ingest FEC independent expenditures
    FecIndependentExpenditures {
        #[arg(long)]
        cycle: u32,
        #[arg(long)]
        committee_id: String,
        #[arg(long, default_value = "100")]
        limit: u32,
    },
    /// Download and ingest FEC bulk ZIP data for one or more cycles.
    ///
    /// Downloads individual contributions (indiv), committee transactions (oth),
    /// committee master (cm), and candidate-committee links (ccl) from
    /// fec.gov/files/bulk-downloads/. Parses pipe-delimited records into staging
    /// tables for canonicalization.
    FecBulk {
        #[arg(long, value_delimiter = ',', default_value = "2026")]
        cycles: Vec<u32>,
        #[arg(long, default_value_t = false)]
        force: bool,
        /// Reparse unchanged local archives without downloading them again.
        #[arg(long, default_value_t = false)]
        reparse: bool,
    },
    /// Ingest Schedule B operating disbursements without rebuilding receipts.
    FecDisbursements {
        #[arg(long, value_delimiter = ',', default_value = "2026")]
        cycles: Vec<u32>,
        #[arg(long, default_value_t = false)]
        force: bool,
    },
    /// Rebuild FEC donor and committee rankings from canonical receipts.
    FecRebuildRankings {
        #[arg(long, value_delimiter = ',', default_value = "2026")]
        cycles: Vec<i32>,
    },
    /// Reparse FEC candidate, committee, and linkage archives only.
    FecRefreshIdentities {
        #[arg(long, value_delimiter = ',', default_value = "2026")]
        cycles: Vec<u32>,
    },
    /// Discover Senate eFD report links through the terms-gated official search.
    SenateEfd {
        /// Inclusive start date. Defaults to the beginning of required coverage.
        #[arg(long)]
        submitted_start_date: Option<String>,
        /// Inclusive end date. Defaults to the day the command runs.
        #[arg(long)]
        submitted_end_date: Option<String>,
        /// Provider page size; this is not a row cap.
        #[arg(long, default_value_t = 100)]
        page_size: usize,
    },
    /// Refresh SEC company/ticker identifiers for disclosure assets.
    SecAssetCrosswalk,
    /// Ingest lobbying filings
    LobbyingFilings {
        #[arg(long)]
        year: u32,
        #[arg(long, default_value = "1")]
        start_page: u32,
        #[arg(long)]
        run_correlation_id: Option<String>,
        #[arg(long, default_value = "50")]
        page_size: u32,
        #[arg(long, default_value = "5")]
        limit_pages: u32,
    },
    /// Ingest bill amendments from Congress.gov
    CongressAmendments {
        #[arg(long)]
        congress: u32,
        #[arg(long, default_value = "50")]
        limit: u32,
    },
    /// Create explicit LDA-to-bill relationship evidence links
    LobbyingBillLinks {
        #[arg(long, default_value = "2026")]
        year: u32,
    },
    /// Import a JSONL manifest of official disclosure documents.
    DisclosureManifest {
        #[arg(long)]
        path: String,
        #[arg(long)]
        source: String,
    },
    /// Import a JSONL organization/company identifier crosswalk.
    OrganizationManifest {
        #[arg(long)]
        path: String,
        #[arg(long)]
        source: String,
    },
    /// Parse an official House PTR PDF through pdftotext and write normalized transactions.
    HousePtr {
        #[arg(long)]
        pdf_path: String,
        #[arg(long)]
        bioguide_id: String,
        #[arg(long)]
        filing_id: String,
        #[arg(long)]
        source_url: String,
    },
    /// Download an official House PTR PDF, then parse it through the House PTR importer.
    HousePtrUrl {
        #[arg(long)]
        url: String,
        #[arg(long)]
        output_path: String,
        #[arg(long)]
        bioguide_id: String,
        #[arg(long)]
        filing_id: String,
    },
    /// Ingest Voteview data
    Voteview {
        #[arg(long)]
        members: bool,
        #[arg(long)]
        votes: bool,
        #[arg(long)]
        rollcalls: bool,
    },
    /// Refresh materialized views
    RefreshMaterializedViews,
    /// Derive evidence-backed relationship edges from normalized records
    RefreshRelationships,
    /// Run smoke test: members + influence-seeds + fec-committees + congress-bills + refresh-mvs
    AllSmoke,
}

// ── Main ───────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL is required for intel_backend ingest");

    let db = Db::connect(&database_url)
        .await
        .expect("Failed to connect to database");

    db.migrate()
        .await
        .expect("Failed to run database migrations");

    // Build a repository with a no-op cache (ingest writes invalidate cache).
    let repo = Repository::new(db, Arc::new(CacheLayer::new(300)));

    match &cli.command {
        Command::ProfileEvidenceAll { congress, cycle } => {
            cmd_profile_evidence_all(&repo, *congress, *cycle).await
        }
        Command::InfluenceSeeds => cmd_influence_seeds(&repo).await,
        Command::Members {
            current_only,
            limit,
        } => cmd_members(&repo, *current_only, *limit).await,
        Command::CongressMembers { limit } => cmd_congress_members(&repo, *limit).await,
        Command::CongressBills { congress, limit } => {
            cmd_congress_bills(&repo, *congress, *limit).await
        }
        Command::CongressVotes {
            congress,
            chamber,
            limit,
        } => cmd_congress_votes(&repo, *congress, chamber, *limit).await,
        Command::FecCandidates { cycle, limit } => cmd_fec_candidates(&repo, *cycle, *limit).await,
        Command::FecCommittees { q, limit } => cmd_fec_committees(&repo, q, *limit).await,
        Command::FecTransactions {
            cycle,
            committee_id,
            limit,
        } => cmd_fec_transactions(&repo, *cycle, committee_id, *limit).await,
        Command::FecBulk {
            cycles,
            force,
            reparse,
        } => {
            if let Err(error) = cmd_fec_bulk(&repo, cycles, *force, *reparse).await {
                tracing::error!(error = %error, "FEC bulk ingest failed");
                std::process::exit(1);
            }
        }
        Command::FecDisbursements { cycles, force } => {
            if let Err(error) = cmd_fec_disbursements(&repo, cycles, *force).await {
                tracing::error!(error = %error, "FEC disbursement ingest failed");
                std::process::exit(1);
            }
        }
        Command::FecRebuildRankings { cycles } => {
            if let Err(error) = cmd_fec_rebuild_rankings(&repo, cycles).await {
                tracing::error!(error = %error, "FEC ranking rebuild failed");
                std::process::exit(1);
            }
        }
        Command::FecRefreshIdentities { cycles } => {
            if let Err(error) = cmd_fec_refresh_identities(&repo, cycles).await {
                tracing::error!(error = %error, "FEC identity refresh failed");
                std::process::exit(1);
            }
        }
        Command::SenateEfd {
            submitted_start_date,
            submitted_end_date,
            page_size,
        } => {
            let start = submitted_start_date.as_deref().unwrap_or("01/01/2012");
            let end = submitted_end_date
                .clone()
                .unwrap_or_else(|| chrono::Utc::now().format("%m/%d/%Y").to_string());
            if let Err(error) = cmd_senate_efd(&repo, start, &end, *page_size).await {
                tracing::error!(error = %error, "Senate eFD discovery failed");
                std::process::exit(1);
            }
        }
        Command::SecAssetCrosswalk => {
            if let Err(error) = cmd_sec_asset_crosswalk(&repo).await {
                tracing::error!(error = %error, "SEC asset crosswalk failed");
                std::process::exit(1);
            }
        }
        Command::FecIndependentExpenditures {
            cycle,
            committee_id,
            limit,
        } => cmd_fec_independent_expenditures(&repo, *cycle, committee_id, *limit).await,
        Command::LobbyingFilings {
            year,
            start_page,
            run_correlation_id,
            page_size,
            limit_pages,
        } => {
            cmd_lobbying_filings(
                &repo,
                *year,
                *start_page,
                run_correlation_id.as_deref(),
                *page_size,
                *limit_pages,
            )
            .await
        }
        Command::CongressAmendments { congress, limit } => {
            cmd_congress_amendments(&repo, *congress, *limit).await
        }
        Command::LobbyingBillLinks { year } => cmd_lobbying_bill_links(&repo, *year).await,
        Command::DisclosureManifest { path, source } => {
            cmd_disclosure_manifest(&repo, path, source).await
        }
        Command::OrganizationManifest { path, source } => {
            cmd_organization_manifest(&repo, path, source).await
        }
        Command::HousePtr {
            pdf_path,
            bioguide_id,
            filing_id,
            source_url,
        } => cmd_house_ptr(&repo, pdf_path, bioguide_id, filing_id, source_url).await,
        Command::HousePtrUrl {
            url,
            output_path,
            bioguide_id,
            filing_id,
        } => cmd_house_ptr_url(&repo, url, output_path, bioguide_id, filing_id).await,
        Command::Voteview {
            members,
            votes,
            rollcalls,
        } => cmd_voteview(&repo, *members, *votes, *rollcalls).await,
        Command::RefreshMaterializedViews => cmd_refresh_materialized_views(&repo).await,
        Command::RefreshRelationships => cmd_refresh_relationships(&repo).await,
        Command::AllSmoke => cmd_all_smoke(&repo).await,
    }
}

async fn cmd_profile_evidence_all(repo: &Repository, congress: u32, cycle: u32) {
    info!(
        congress,
        cycle, "Starting deterministic all-member profile evidence refresh"
    );
    std::env::set_var("INGEST_CONTINUE_ON_ERROR", "1");
    cmd_members(repo, true, 1_000).await;
    cmd_congress_members(repo, 1_000).await;
    cmd_voteview(repo, true, true, true).await;
    cmd_congress_bills(repo, congress, 250).await;
    cmd_member_legislation_all(repo, congress).await;
    cmd_fec_candidates(repo, cycle, 1_000).await;
    cmd_refresh_materialized_views(repo).await;
    cmd_refresh_relationships(repo).await;
    info!(
        congress,
        cycle, "All-member profile evidence refresh finished"
    );
}

async fn cmd_member_legislation_all(repo: &Repository, congress: u32) {
    let api_key = match std::env::var("CONGRESS_GOV_API_KEY") {
        Ok(key) if !key.is_empty() => key,
        _ => {
            tracing::warn!("Skipping all-member legislation: CONGRESS_GOV_API_KEY is unavailable");
            return;
        }
    };
    let run_id = repo
        .create_source_run(
            SOURCE_CONGRESS_GOV,
            "/v3/member/{bioguide}/sponsored-and-cosponsored-legislation",
            serde_json::json!({ "congress": congress, "scope": "all_current_members" }),
        )
        .await
        .expect("Failed to create all-member legislation source_run");
    let member_ids: Vec<String> = sqlx::query_scalar(
        "SELECT bioguide_id FROM members WHERE in_office = true ORDER BY bioguide_id",
    )
    .fetch_all(repo.pool())
    .await
    .unwrap_or_default();
    let client = congress_api::Client::new(api_key);
    let mut seen = 0i64;
    let mut written = 0i64;

    for bioguide_id in member_ids {
        let sponsored = client.get_member_sponsored_legislation(&bioguide_id).await;
        if let Ok(response) = sponsored {
            for bill in response
                .sponsored_legislation
                .into_iter()
                .filter(|bill| bill.congress == congress as i32)
            {
                seen += 1;
                if ingest_member_legislation_item(repo, run_id, &bioguide_id, "sponsor", bill)
                    .await
                    .is_ok()
                {
                    written += 2;
                }
            }
        }
        let cosponsored = client
            .get_member_cosponsored_legislation(&bioguide_id)
            .await;
        if let Ok(response) = cosponsored {
            for bill in response
                .cosponsored_legislation
                .into_iter()
                .filter(|bill| bill.congress == congress as i32)
            {
                seen += 1;
                if ingest_member_legislation_item(repo, run_id, &bioguide_id, "cosponsor", bill)
                    .await
                    .is_ok()
                {
                    written += 2;
                }
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(75)).await;
    }

    let status = if seen > 0 { "success" } else { "partial" };
    repo.finish_source_run(run_id, status, seen, written, None)
        .await
        .expect("Failed to finish all-member legislation source_run");
}

async fn ingest_member_legislation_item(
    repo: &Repository,
    run_id: uuid::Uuid,
    bioguide_id: &str,
    sponsor_type: &str,
    bill: congress_api::MemberSponsoredBill,
) -> Result<(), sqlx::Error> {
    let bill_number = bill.number.parse::<i32>().unwrap_or(0);
    let bill_type = bill.bill_type.to_lowercase();
    let bill_id = schema::build_bill_id(bill.congress, &bill_type, bill_number);
    let introduced_date = bill
        .introduced_date
        .as_deref()
        .and_then(|date| NaiveDate::parse_from_str(date, "%Y-%m-%d").ok());
    let latest_action_date = bill
        .latest_action
        .as_ref()
        .and_then(|action| action.action_date.as_deref())
        .and_then(|date| NaiveDate::parse_from_str(date, "%Y-%m-%d").ok());
    let latest_action_text = bill
        .latest_action
        .as_ref()
        .and_then(|action| action.text.as_deref());
    let policy_area = bill.policy_area.as_ref().map(|area| area.name.as_str());

    repo.upsert_bill(BillUpsert {
        congress: bill.congress,
        bill_type: &bill_type,
        bill_number,
        bill_id: &bill_id,
        title: &bill.title,
        introduced_date,
        origin_chamber: None,
        policy_area,
        latest_action_date,
        latest_action_text,
        status: latest_action_text.unwrap_or("introduced"),
        url: None,
        source_run_id: Some(run_id),
    })
    .await?;
    repo.upsert_bill_sponsor(BillSponsorUpsert {
        bill_id: &bill_id,
        bioguide_id: Some(bioguide_id),
        sponsor_type,
        sponsorship_date: introduced_date,
        is_original_cosponsor: false,
        source_run_id: Some(run_id),
    })
    .await?;
    Ok(())
}

async fn cmd_refresh_relationships(repo: &Repository) {
    let run_id = repo
        .create_source_run(
            SOURCE_RELATIONSHIP_DERIVATION,
            "refresh-relationships",
            serde_json::json!({}),
        )
        .await
        .expect("Failed to create relationship source_run");
    match repo.refresh_relationship_evidence(run_id).await {
        Ok((seen, written)) => {
            info!(seen, written, "Relationship derivation complete");
            repo.finish_source_run(run_id, "success", seen, written, None)
                .await
                .expect("Failed to finish relationship source_run");
        }
        Err(error) => {
            let message = error.to_string();
            eprintln!("Relationship derivation failed: {message}");
            repo.finish_source_run(run_id, "failed", 0, 0, Some(&message))
                .await
                .expect("Failed to finish relationship source_run");
            std::process::exit(1);
        }
    }
}

#[derive(Debug, serde::Deserialize)]
struct DisclosureManifestRow {
    bioguide_id: Option<String>,
    chamber: String,
    report_type: String,
    filing_date: Option<NaiveDate>,
    reporting_period_start: Option<NaiveDate>,
    reporting_period_end: Option<NaiveDate>,
    source_record_id: Option<String>,
    source_url: String,
    raw_sha256: Option<String>,
    raw_storage_key: Option<String>,
    parse_status: Option<String>,
    parse_error: Option<String>,
}

async fn cmd_disclosure_manifest(repo: &Repository, path: &str, source: &str) {
    let run_id = repo
        .create_source_run(
            source,
            "disclosure-manifest",
            serde_json::json!({"path": path}),
        )
        .await
        .expect("Failed to create source_run");
    let result = async {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let mut seen = 0i64;
        let mut written = 0i64;
        for (line_number, line) in reader.lines().enumerate() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            let row: DisclosureManifestRow = serde_json::from_str(&line)
                .map_err(|error| format!("invalid JSONL at line {}: {error}", line_number + 1))?;
            seen += 1;
            repo.upsert_disclosure_document(
                &intel_backend::repository::organizations::DisclosureDocumentInput {
                    bioguide_id: row.bioguide_id.as_deref(),
                    chamber: &row.chamber,
                    report_type: &row.report_type,
                    filing_date: row.filing_date,
                    reporting_period_start: row.reporting_period_start,
                    reporting_period_end: row.reporting_period_end,
                    source,
                    source_record_id: row.source_record_id.as_deref(),
                    source_url: &row.source_url,
                    raw_sha256: row.raw_sha256.as_deref(),
                    raw_storage_key: row.raw_storage_key.as_deref(),
                    parse_status: row.parse_status.as_deref().unwrap_or("pending"),
                    parse_error: row.parse_error.as_deref(),
                    source_run_id: Some(run_id),
                },
            )
            .await?;
            written += 1;
        }
        Ok::<(i64, i64), Box<dyn std::error::Error>>((seen, written))
    }
    .await;
    finish_api_run(repo, run_id, result).await;
}

#[derive(Debug, serde::Deserialize)]
struct OrganizationManifestRow {
    canonical_name: String,
    organization_type: String,
    description: Option<String>,
    website_url: Option<String>,
    identifiers: Vec<OrganizationIdentifierManifestRow>,
}

#[derive(Debug, serde::Deserialize)]
struct OrganizationIdentifierManifestRow {
    scheme: String,
    value: String,
}

async fn cmd_organization_manifest(repo: &Repository, path: &str, source: &str) {
    let run_id = repo
        .create_source_run(
            source,
            "organization-manifest",
            serde_json::json!({"path": path}),
        )
        .await
        .expect("Failed to create source_run");
    let result = async {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let mut seen = 0i64;
        let mut written = 0i64;
        for (line_number, line) in reader.lines().enumerate() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            let row: OrganizationManifestRow = serde_json::from_str(&line)
                .map_err(|error| format!("invalid JSONL at line {}: {error}", line_number + 1))?;
            let organization_id = repo
                .upsert_organization(
                    &intel_backend::repository::organizations::OrganizationInput {
                        canonical_name: &row.canonical_name,
                        organization_type: &row.organization_type,
                        description: row.description.as_deref(),
                        website_url: row.website_url.as_deref(),
                    },
                )
                .await?;
            for identifier in row.identifiers {
                repo.upsert_organization_identifier(
                    organization_id,
                    &identifier.scheme,
                    &identifier.value,
                    source,
                    Some(run_id),
                )
                .await?;
            }
            seen += 1;
            written += 1;
        }
        Ok::<(i64, i64), Box<dyn std::error::Error>>((seen, written))
    }
    .await;
    finish_api_run(repo, run_id, result).await;
}

async fn cmd_house_ptr(
    repo: &Repository,
    pdf_path: &str,
    bioguide_id: &str,
    filing_id: &str,
    source_url: &str,
) {
    let run_id = repo
        .create_source_run(
            "house_disclosures",
            "house-ptr",
            serde_json::json!({"pdf_path": pdf_path, "filing_id": filing_id}),
        )
        .await
        .expect("Failed to create House disclosure source_run");
    let result = async {
        let raw_pdf = std::fs::read(pdf_path)?;
        let digest = format!("{:x}", Sha256::digest(&raw_pdf));
        let extracted = ProcessCommand::new("pdftotext")
            .args(["-layout", pdf_path, "-"])
            .output()?;
        if !extracted.status.success() {
            return Err(format!("pdftotext failed with status {}", extracted.status).into());
        }
        let text = String::from_utf8(extracted.stdout)?;
        let parsed = intel_backend::disclosures::parse_house_ptr_text(&text);
        let document_id = repo
            .upsert_disclosure_document(
                &intel_backend::repository::organizations::DisclosureDocumentInput {
                    bioguide_id: Some(bioguide_id),
                    chamber: "House",
                    report_type: "PTR",
                    filing_date: None,
                    reporting_period_start: None,
                    reporting_period_end: None,
                    source: "house_disclosures",
                    source_record_id: Some(filing_id),
                    source_url,
                    raw_sha256: Some(&digest),
                    raw_storage_key: Some(pdf_path),
                    parse_status: if parsed.is_empty() {
                        "partial"
                    } else {
                        "parsed"
                    },
                    parse_error: if parsed.is_empty() {
                        Some("No transaction rows were anchored in extracted text")
                    } else {
                        None
                    },
                    source_run_id: Some(run_id),
                },
            )
            .await?;
        for transaction in &parsed {
            repo.upsert_disclosure_transaction(
                &intel_backend::repository::organizations::DisclosureTransactionInput {
                    document_id,
                    bioguide_id: Some(bioguide_id),
                    owner_type: &transaction.owner_type,
                    asset_name: &transaction.asset_name,
                    ticker: transaction.ticker.as_deref(),
                    organization_id: None,
                    transaction_type: &transaction.transaction_type,
                    amount_min: transaction.amount_min,
                    amount_max: transaction.amount_max,
                    transaction_date: transaction.transaction_date,
                    disclosure_date: transaction.disclosure_date,
                    filing_url: Some(source_url),
                    raw_json: serde_json::json!({"pdf_path": pdf_path}),
                },
            )
            .await?;
        }
        Ok::<(i64, i64), Box<dyn std::error::Error>>((parsed.len() as i64, parsed.len() as i64))
    }
    .await;
    finish_api_run(repo, run_id, result).await;
}

async fn cmd_house_ptr_url(
    repo: &Repository,
    url: &str,
    output_path: &str,
    bioguide_id: &str,
    filing_id: &str,
) {
    let result = async {
        let response = reqwest::get(url).await?;
        let response = response.error_for_status()?;
        let body = response.bytes().await?;
        if body.len() < 4 || &body[..4] != b"%PDF" {
            return Err("official disclosure URL did not return a PDF".into());
        }
        if let Some(parent) = std::path::Path::new(output_path).parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)?;
            }
        }
        std::fs::write(output_path, &body)?;
        Ok::<(), Box<dyn std::error::Error>>(())
    }
    .await;
    if let Err(error) = result {
        eprintln!("House disclosure download failed: {error}");
        std::process::exit(1);
    }
    cmd_house_ptr(repo, output_path, bioguide_id, filing_id, url).await;
}

// ── Influence Seeds ────────────────────────────────────────────────────────

async fn cmd_influence_seeds(repo: &Repository) {
    info!("Seeding influence network definitions …");

    let run_id = repo
        .create_source_run(SOURCE_MANUAL, "influence-seeds", serde_json::json!({}))
        .await
        .expect("Failed to create source_run");

    let result = try_influence_seeds(repo, run_id).await;
    match result {
        Ok((seen, written)) => {
            info!(seen, written, "Influence seeds complete");
            if let Err(err) = repo
                .finish_source_run(run_id, "success", seen, written, None)
                .await
            {
                eprintln!("Failed to finish source_run {run_id}: {err}");
            }
        }
        Err(e) => {
            eprintln!("Influence seeds failed: {e}");
            if let Err(err) = repo
                .finish_source_run(run_id, "failed", 0, 0, Some(&e.to_string()))
                .await
            {
                eprintln!("Failed to finish source_run {run_id}: {err}");
            }
            std::process::exit(1);
        }
    }
}

async fn try_influence_seeds(
    repo: &Repository,
    run_id: uuid::Uuid,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    let mut seen = 0i64;
    let mut written = 0i64;

    let networks = [
        InfluenceNetworkUpsert {
            network_slug: "aipac",
            display_name: "AIPAC / American Israel Public Affairs Committee",
            aliases: &["AIPAC", "American Israel Public Affairs Committee", "United Democracy Project", "UDP"],
            description: "Verified public FEC-linked AIPAC political spending entities. Opaque 501(c)(4) donor sources are not attributed.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for AMERICAN ISRAEL and UNITED DEMOCRACY PROJECT, verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "nra",
            display_name: "NRA / National Rifle Association",
            aliases: &["NRA", "National Rifle Association", "NRA Political Victory Fund"],
            description: "NRA Political Victory Fund and affiliated NRA spending entities. Deterministic FEC entity resolution.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for NRA POLITICAL VICTORY FUND verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "planned-parenthood",
            display_name: "Planned Parenthood Action Fund",
            aliases: &["Planned Parenthood", "Planned Parenthood Action Fund"],
            description: "Planned Parenthood Action Fund PAC and affiliated spending entities.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for PLANNED PARENTHOOD verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "afl-cio",
            display_name: "AFL-CIO / Committee on Political Education",
            aliases: &["AFL-CIO", "COPE", "Committee on Political Education"],
            description: "AFL-CIO COPE Political Contributions Committee and labor federation spending entities.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for AFL-CIO verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "chamber-of-commerce",
            display_name: "U.S. Chamber of Commerce",
            aliases: &["US Chamber", "U.S. Chamber of Commerce", "Chamber of Commerce"],
            description: "U.S. Chamber of Commerce PAC and affiliated business advocacy spending.",
            category: "industry_pac",
            confidence: "verified",
            source_citation: "OpenFEC committee search for CHAMBER OF COMMERCE verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "koch-network",
            display_name: "Koch Network / Americans for Prosperity Action",
            aliases: &["Koch Network", "Americans for Prosperity", "AFP Action"],
            description: "Americans for Prosperity Action (AFP Action) super PAC and affiliated Koch network spending entities.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for AMERICANS FOR PROSPERITY verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "emilys-list",
            display_name: "EMILY's List",
            aliases: &["EMILY's List", "EMILYS List"],
            description: "EMILY's List federal PAC supporting pro-choice Democratic women candidates.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for EMILY'S LIST verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "club-for-growth",
            display_name: "Club for Growth",
            aliases: &["Club for Growth", "Club for Growth Action"],
            description: "Club for Growth PAC and Club for Growth Action super PAC supporting fiscally conservative candidates.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for CLUB FOR GROWTH verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "lcv",
            display_name: "League of Conservation Voters",
            aliases: &["LCV", "League of Conservation Voters", "LCV Action Fund"],
            description: "LCV Action Fund and affiliated environmental advocacy spending entities.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for LEAGUE OF CONSERVATION VOTERS verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "nar",
            display_name: "National Association of Realtors",
            aliases: &["NAR", "National Association of Realtors", "RPAC"],
            description: "Realtors Political Action Committee (RPAC) - one of the largest trade association PACs.",
            category: "industry_pac",
            confidence: "verified",
            source_citation: "OpenFEC committee search for REALTORS POLITICAL verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "ama",
            display_name: "American Medical Association",
            aliases: &["AMA", "American Medical Association", "AMPAC"],
            description: "AMPAC - American Medical Association Political Action Committee.",
            category: "industry_pac",
            confidence: "verified",
            source_citation: "OpenFEC committee search for AMERICAN MEDICAL ASSOCIATION verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "sierra-club",
            display_name: "Sierra Club",
            aliases: &["Sierra Club", "Sierra Club Political Committee"],
            description: "Sierra Club Political Committee and affiliated environmental advocacy spending.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for SIERRA CLUB verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "nrlc",
            display_name: "National Right to Life",
            aliases: &["NRLC", "National Right to Life"],
            description: "National Right to Life Political Action Committee and affiliated pro-life advocacy spending.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for NATIONAL RIGHT TO LIFE verified 2026-07-03",
            source_run_id: Some(run_id),
        },
    ];

    let committees = [
        InfluenceNetworkCommitteeUpsert {
            network_slug: "aipac",
            committee_id: "C00797670",
            committee_name: "AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE",
            role: "direct_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=AMERICAN ISRAEL",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "aipac",
            committee_id: "C00799031",
            committee_name: "UNITED DEMOCRACY PROJECT ('UDP')",
            role: "super_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=UNITED DEMOCRACY PROJECT",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "aipac",
            committee_id: "C90022864",
            committee_name: "DEMOCRATIC MAJORITY FOR ISRAEL",
            role: "independent_expenditure_filer",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=DEMOCRATIC MAJORITY ISRAEL",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "nra",
            committee_id: "C00053553",
            committee_name: "NRA POLITICAL VICTORY FUND",
            role: "direct_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=NRA POLITICAL",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "planned-parenthood",
            committee_id: "C00314617",
            committee_name: "PLANNED PARENTHOOD ACTION FUND INC.",
            role: "direct_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=PLANNED PARENTHOOD ACTION",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "planned-parenthood",
            committee_id: "C00532617",
            committee_name: "PLANNED PARENTHOOD VOTES",
            role: "super_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=PLANNED PARENTHOOD VOTES",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "afl-cio",
            committee_id: "C00003806",
            committee_name: "AFL-CIO COPE POLITICAL CONTRIBUTIONS COMMITTEE",
            role: "direct_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=AFL-CIO",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "chamber-of-commerce",
            committee_id: "C00082040",
            committee_name: "U.S. CHAMBER OF COMMERCE POLITICAL ACTION COMMITTEE",
            role: "direct_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=CHAMBER OF COMMERCE",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "koch-network",
            committee_id: "C00687103",
            committee_name: "AMERICANS FOR PROSPERITY ACTION, INC.",
            role: "super_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=AMERICANS FOR PROSPERITY ACTION",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "emilys-list",
            committee_id: "C00193433",
            committee_name: "EMILY'S LIST",
            role: "direct_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=EMILY'S LIST",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "club-for-growth",
            committee_id: "C00387472",
            committee_name: "CLUB FOR GROWTH PAC",
            role: "direct_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=CLUB FOR GROWTH PAC",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "club-for-growth",
            committee_id: "C00487470",
            committee_name: "CLUB FOR GROWTH ACTION",
            role: "super_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=CLUB FOR GROWTH ACTION",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "lcv",
            committee_id: "C00359943",
            committee_name: "LEAGUE OF CONSERVATION VOTERS ACTION FUND",
            role: "direct_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=LEAGUE OF CONSERVATION",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "nar",
            committee_id: "C00030718",
            committee_name: "REALTORS POLITICAL ACTION COMMITTEE",
            role: "direct_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=REALTORS POLITICAL",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "ama",
            committee_id: "C00004176",
            committee_name: "AMERICAN MEDICAL ASSOCIATION POLITICAL ACTION COMMITTEE",
            role: "direct_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=AMERICAN MEDICAL ASSOCIATION",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "sierra-club",
            committee_id: "C00135368",
            committee_name: "SIERRA CLUB POLITICAL COMMITTEE",
            role: "direct_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=SIERRA CLUB",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkCommitteeUpsert {
            network_slug: "nrlc",
            committee_id: "C00053447",
            committee_name: "NATIONAL RIGHT TO LIFE POLITICAL ACTION COMMITTEE",
            role: "direct_pac",
            confidence: "verified",
            source_citation: "OpenFEC committees?q=NATIONAL RIGHT TO LIFE",
            source_run_id: Some(run_id),
        },
    ];

    for network in networks {
        repo.upsert_influence_network(network).await?;
        seen += 1;
        written += 1;
    }

    for committee in committees {
        repo.upsert_influence_network_committee(committee).await?;
        seen += 1;
        written += 1;
    }

    Ok((seen, written))
}

// ── Members (unitedstates/congress-legislators) ────────────────────────────

async fn cmd_members(repo: &Repository, current_only: bool, limit: u32) {
    let endpoint = if current_only {
        "legislators-current.json"
    } else {
        "legislators-historical.json"
    };

    info!(
        endpoint,
        limit, "Ingesting members from unitedstates/congress-legislators"
    );

    let run_id = repo
        .create_source_run(
            SOURCE_UNITEDSTATES,
            endpoint,
            serde_json::json!({ "limit": limit, "current_only": current_only }),
        )
        .await
        .expect("Failed to create source_run");

    let result = try_members(repo, run_id, current_only, limit).await;
    match result {
        Ok((seen, written)) => {
            info!(seen, written, "Member ingest complete");
            if let Err(err) = repo
                .finish_source_run(run_id, "success", seen, written, None)
                .await
            {
                eprintln!("Failed to finish source_run {run_id}: {err}");
            }
        }
        Err(e) => {
            eprintln!("Member ingest failed: {e}");
            if let Err(err) = repo
                .finish_source_run(run_id, "failed", 0, 0, Some(&e.to_string()))
                .await
            {
                eprintln!("Failed to finish source_run {run_id}: {err}");
            }
            std::process::exit(1);
        }
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
struct UnitedStatesLegislator {
    id: UnitedStatesIds,
    name: UnitedStatesName,
    bio: Option<UnitedStatesBio>,
    terms: Vec<UnitedStatesTerm>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
struct UnitedStatesIds {
    bioguide: Option<String>,
    fec: Option<Vec<String>>,
    icpsr: Option<serde_json::Value>,
    opensecrets: Option<String>,
    wikidata: Option<String>,
    ballotpedia: Option<String>,
    govtrack: Option<u32>,
    votesmart: Option<u32>,
    cspan: Option<u32>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
struct UnitedStatesName {
    first: Option<String>,
    middle: Option<String>,
    last: Option<String>,
    suffix: Option<String>,
    official_full: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
struct UnitedStatesBio {
    birthday: Option<String>,
    gender: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
struct UnitedStatesTerm {
    #[serde(rename = "type")]
    term_type: String,
    start: String,
    end: String,
    state: String,
    district: Option<u32>,
    party: String,
    #[serde(rename = "class", default)]
    senate_class: Option<u32>,
    #[serde(default)]
    how: Option<String>,
}

#[derive(serde::Deserialize)]
struct UnitedStatesSocialMedia {
    id: UnitedStatesSocialIds,
    social: UnitedStatesSocial,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
struct UnitedStatesSocialIds {
    bioguide: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
struct UnitedStatesSocial {
    twitter: Option<String>,
    facebook: Option<String>,
    youtube: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
struct UnitedStatesCommittee {
    thomas_id: Option<String>,
    name: String,
    #[serde(rename = "type")]
    committee_type: String,
    house_committee_id: Option<String>,
    senate_committee_id: Option<String>,
    jurisdiction: Option<String>,
    url: Option<String>,
}

async fn try_members(
    repo: &Repository,
    run_id: uuid::Uuid,
    _current_only: bool,
    limit: u32,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    // 1. Fetch legislators-current.json
    let url = "https://unitedstates.github.io/congress-legislators/legislators-current.json";
    let resp = client.get(url).send().await?;
    let legislators: Vec<UnitedStatesLegislator> = resp.json().await?;

    let mut seen = 0i64;
    let mut written = 0i64;

    for leg in legislators.iter().take(limit as usize) {
        seen += 1;

        let bioguide = match &leg.id.bioguide {
            Some(id) => id.clone(),
            None => continue,
        };

        let birthday = leg
            .bio
            .as_ref()
            .and_then(|b| b.birthday.as_ref())
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

        let current_term = leg.terms.last();

        let (raw_chamber, raw_party, current_state, current_district, in_office) =
            match current_term {
                Some(t) if t.end.as_str() >= "2025" || t.end.as_str() >= "2026" => {
                    let chamber = match t.term_type.as_str() {
                        "rep" => "House",
                        "sen" => "Senate",
                        _ => "Unknown",
                    };
                    let district = t.district.map(|d| d.to_string()).unwrap_or_default();
                    (
                        chamber.to_string(),
                        t.party.clone(),
                        t.state.clone(),
                        district,
                        true,
                    )
                }
                _ => (
                    "Unknown".to_string(),
                    "Unknown".to_string(),
                    String::new(),
                    String::new(),
                    false,
                ),
            };
        let current_chamber = normalize_chamber(&raw_chamber);
        let current_party = normalize_party(&raw_party);

        let full_name = leg.name.official_full.as_deref().unwrap_or("").to_string();

        repo.upsert_member(MemberUpsert {
            bioguide_id: &bioguide,
            first_name: leg.name.first.as_deref().unwrap_or(""),
            middle_name: leg.name.middle.as_deref().unwrap_or(""),
            last_name: leg.name.last.as_deref().unwrap_or(""),
            suffix: leg.name.suffix.as_deref().unwrap_or(""),
            official_full_name: &full_name,
            birthday,
            gender: leg.bio.as_ref().and_then(|b| b.gender.as_deref()),
            current_party: &current_party,
            current_state: &current_state,
            current_district: &current_district,
            current_chamber: &current_chamber,
            in_office,
            depiction_url: None,
            website_url: None,
            contact_form: None,
            office_address: None,
            phone: None,
            hometown: None,
            birthplace: None,
            education: serde_json::Value::Array(vec![]),
            prior_employment: serde_json::Value::Array(vec![]),
            nominate_dim1: None,
            nominate_dim2: None,
            source_run_id: Some(run_id),
        })
        .await?;
        written += 1;

        // Write member_identifiers for each known scheme
        let ids = &leg.id;
        if let Some(fec_ids) = &ids.fec {
            for fec_id in fec_ids {
                repo.upsert_member_identifier(&bioguide, schema::SCHEME_FEC, fec_id, Some(run_id))
                    .await?;
                written += 1;
            }
        }
        if let Some(icpsr) = &ids.icpsr {
            let icpsr_str = icpsr
                .as_u64()
                .map(|n| n.to_string())
                .or_else(|| icpsr.as_str().map(|s| s.to_string()))
                .unwrap_or_default();
            if !icpsr_str.is_empty() {
                repo.upsert_member_identifier(
                    &bioguide,
                    schema::SCHEME_ICPSR,
                    &icpsr_str,
                    Some(run_id),
                )
                .await?;
                written += 1;
            }
        }
        if let Some(opensecrets) = &ids.opensecrets {
            repo.upsert_member_identifier(
                &bioguide,
                schema::SCHEME_OPENSECRETS,
                opensecrets,
                Some(run_id),
            )
            .await?;
            written += 1;
        }
        if let Some(wikidata) = &ids.wikidata {
            repo.upsert_member_identifier(
                &bioguide,
                schema::SCHEME_WIKIDATA,
                wikidata,
                Some(run_id),
            )
            .await?;
            written += 1;
        }
        if let Some(ballotpedia) = &ids.ballotpedia {
            repo.upsert_member_identifier(
                &bioguide,
                schema::SCHEME_BALLOTPEDIA,
                ballotpedia,
                Some(run_id),
            )
            .await?;
            written += 1;
        }
        if let Some(govtrack) = ids.govtrack {
            repo.upsert_member_identifier(
                &bioguide,
                schema::SCHEME_GOVTRACK,
                &govtrack.to_string(),
                Some(run_id),
            )
            .await?;
            written += 1;
        }
        if let Some(votesmart) = ids.votesmart {
            repo.upsert_member_identifier(
                &bioguide,
                schema::SCHEME_VOTESMART,
                &votesmart.to_string(),
                Some(run_id),
            )
            .await?;
            written += 1;
        }
        if let Some(cspan) = ids.cspan {
            repo.upsert_member_identifier(
                &bioguide,
                schema::SCHEME_CSPAN,
                &cspan.to_string(),
                Some(run_id),
            )
            .await?;
            written += 1;
        }

        // Write member_terms
        for term in &leg.terms {
            let chamber = match term.term_type.as_str() {
                "rep" => "House",
                "sen" => "Senate",
                _ => &term.term_type,
            };
            let start_date = match NaiveDate::parse_from_str(&term.start, "%Y-%m-%d") {
                Ok(d) => d,
                Err(_) => continue,
            };
            let end_date = NaiveDate::parse_from_str(&term.end, "%Y-%m-%d").ok();
            let district = term.district.map(|d| d.to_string());
            let senate_class = term.senate_class.map(|c| c as i32);

            repo.upsert_member_term(MemberTermUpsert {
                bioguide_id: &bioguide,
                chamber,
                state: &term.state,
                district: district.as_deref(),
                party: &normalize_party(&term.party),
                start_date,
                end_date,
                senate_class,
                how: term.how.as_deref(),
                source: SOURCE_UNITEDSTATES,
                source_run_id: Some(run_id),
            })
            .await?;
            written += 1;
        }
    }

    // 2. Fetch social media
    let social_url =
        "https://unitedstates.github.io/congress-legislators/legislators-social-media.json";
    let social_resp = client.get(social_url).send().await?;
    let social_entries: Vec<UnitedStatesSocialMedia> = social_resp.json().await?;

    for entry in &social_entries {
        let bioguide = match &entry.id.bioguide {
            Some(id) => id.as_str(),
            None => continue,
        };

        if let Some(twitter) = &entry.social.twitter {
            if repo
                .upsert_social_account(bioguide, "twitter", twitter, true, Some(run_id))
                .await
                .is_ok()
            {
                written += 1;
            }
        }
        if let Some(facebook) = &entry.social.facebook {
            if repo
                .upsert_social_account(bioguide, "facebook", facebook, true, Some(run_id))
                .await
                .is_ok()
            {
                written += 1;
            }
        }
        if let Some(youtube) = &entry.social.youtube {
            if repo
                .upsert_social_account(bioguide, "youtube", youtube, true, Some(run_id))
                .await
                .is_ok()
            {
                written += 1;
            }
        }
    }

    // 3. Fetch committees
    let comm_url = "https://unitedstates.github.io/congress-legislators/committees-current.json";
    let comm_resp = client.get(comm_url).send().await?;
    let committees: Vec<UnitedStatesCommittee> = comm_resp.json().await?;

    for comm in &committees {
        let committee_id = comm
            .thomas_id
            .as_deref()
            .or(comm.house_committee_id.as_deref())
            .or(comm.senate_committee_id.as_deref());
        let comm_id = match committee_id {
            Some(id) => id,
            None => continue,
        };

        let chamber = match comm.committee_type.as_str() {
            "house" => "House",
            "senate" => "Senate",
            "joint" => "Joint",
            _ => "Unknown",
        };

        // Upsert into committees table via direct SQL (no repo method exists)
        sqlx::query(
            r#"INSERT INTO committees
               (committee_id, chamber, name, thomas_id, senate_committee_id,
                house_committee_id, jurisdiction, url, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (committee_id) DO UPDATE SET
                 name                = EXCLUDED.name,
                 chamber             = EXCLUDED.chamber,
                 jurisdiction        = COALESCE(EXCLUDED.jurisdiction, committees.jurisdiction),
                 url                 = COALESCE(EXCLUDED.url, committees.url)"#,
        )
        .bind(comm_id)
        .bind(chamber)
        .bind(&comm.name)
        .bind(&comm.thomas_id)
        .bind(&comm.senate_committee_id)
        .bind(&comm.house_committee_id)
        .bind(&comm.jurisdiction)
        .bind(&comm.url)
        .bind(run_id)
        .execute(repo.pool())
        .await?;
        written += 1;
    }

    // 4. Fetch committee memberships
    let cm_url =
        "https://unitedstates.github.io/congress-legislators/committee-membership-current.json";
    let cm_resp = client.get(cm_url).send().await?;
    let cm_data: serde_json::Value = cm_resp.json().await?;

    // The JSON structure is: { "committee_id": { "thomas_id?": [ { "bioguide": "...", ... } ] } }
    if let Some(obj) = cm_data.as_object() {
        for (cmt_id_raw, members_list) in obj {
            let parent_id = cmt_id_raw.trim_end_matches(char::is_numeric);
            let cmt_id: &str = if parent_id.len() >= 2 && obj.contains_key(parent_id) {
                parent_id
            } else {
                cmt_id_raw
            };
            if let Some(members) = members_list.as_array() {
                for member_val in members {
                    if let Some(member) = member_val.as_object() {
                        let bioguide = match member.get("bioguide").and_then(|v| v.as_str()) {
                            Some(b) => b,
                            None => continue,
                        };
                        let raw_party = member.get("party").and_then(|v| v.as_str());
                        let party = raw_party.map(normalize_party);
                        let rank = member
                            .get("rank")
                            .and_then(|v| v.as_u64())
                            .map(|r| r as i32);
                        let title = member.get("title").and_then(|v| v.as_str());
                        let raw_chamber = member
                            .get("chamber")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Unknown");
                        let chamber = normalize_chamber(raw_chamber);

                        if repo
                            .upsert_committee_assignment(CommitteeAssignmentUpsert {
                                committee_id: cmt_id,
                                bioguide_id: bioguide,
                                congress: 0,
                                chamber: &chamber,
                                rank,
                                title,
                                party: party.as_deref(),
                                source_run_id: Some(run_id),
                            })
                            .await
                            .is_ok()
                        {
                            written += 1;
                        }
                    }
                }
            }
        }
    }

    Ok((seen, written))
}

// ── Congress.gov Members ──────────────────────────────────────────────────

async fn cmd_congress_members(repo: &Repository, limit: u32) {
    let api_key = match std::env::var("CONGRESS_GOV_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => {
            eprintln!("CONGRESS_GOV_API_KEY not set, marking source_run as auth_missing");
            let run_id = repo
                .create_source_run(
                    SOURCE_CONGRESS_GOV,
                    "/v3/member",
                    serde_json::json!({ "limit": limit }),
                )
                .await
                .expect("Failed to create source_run");
            repo.finish_source_run(
                run_id,
                "auth_missing",
                0,
                0,
                Some("CONGRESS_GOV_API_KEY not set"),
            )
            .await
            .expect("Failed to finish auth_missing source_run");
            return;
        }
    };

    let run_id = repo
        .create_source_run(
            SOURCE_CONGRESS_GOV,
            "/v3/member",
            serde_json::json!({ "limit": limit }),
        )
        .await
        .expect("Failed to create source_run");

    let result = try_congress_members(repo, run_id, &api_key, limit).await;
    finish_api_run(repo, run_id, result).await;
}

async fn try_congress_members(
    repo: &Repository,
    run_id: uuid::Uuid,
    api_key: &str,
    limit: u32,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    let client = congress_api::Client::new(api_key.to_string());
    let query = congress_api::query::MemberQuery::default().with_limit(limit);
    let resp = client.get_members(&query).await?;

    let mut seen = 0i64;
    let mut written = 0i64;

    for member in &resp.data {
        seen += 1;
        let depiction_url = bioguide_portrait_url(&member.bioguide_id);

        // Only update depiction_url, website_url, contact fields — don't overwrite
        // higher-confidence identifiers from unitedstates
        let exists: Option<(i32,)> = sqlx::query_as("SELECT 1 FROM members WHERE bioguide_id = $1")
            .bind(&member.bioguide_id)
            .fetch_optional(repo.pool())
            .await?;

        if exists.is_none() {
            let norm_party = normalize_party(&member.party);
            let norm_state = normalize_state(&member.state);
            // Insert a minimal member row if not yet present
            repo.upsert_member(MemberUpsert {
                bioguide_id: &member.bioguide_id,
                first_name: "",
                middle_name: "",
                last_name: "",
                suffix: "",
                official_full_name: "",
                birthday: None,
                gender: None,
                current_party: &norm_party,
                current_state: &norm_state,
                current_district: "",
                current_chamber: "",
                in_office: true,
                depiction_url: depiction_url.as_deref(),
                website_url: None,
                contact_form: None,
                office_address: None,
                phone: None,
                hometown: None,
                birthplace: None,
                education: serde_json::Value::Array(vec![]),
                prior_employment: serde_json::Value::Array(vec![]),
                nominate_dim1: None,
                nominate_dim2: None,
                source_run_id: Some(run_id),
            })
            .await?;
            written += 1;
        } else {
            // Update live fields
            sqlx::query(
                "UPDATE members SET depiction_url = COALESCE($1, depiction_url), last_source_run_id = $2 WHERE bioguide_id = $3",
            )
            .bind(depiction_url.as_deref())
            .bind(run_id)
            .bind(&member.bioguide_id)
            .execute(repo.pool())
            .await?;
            written += 1;
        }
    }

    Ok((seen, written))
}

fn bioguide_portrait_url(bioguide_id: &str) -> Option<String> {
    let normalized = bioguide_id.trim();
    let initial = normalized.chars().next()?;
    if normalized.len() != 7
        || !initial.is_ascii_alphabetic()
        || !normalized[1..]
            .chars()
            .all(|character| character.is_ascii_digit())
    {
        return None;
    }
    Some(format!(
        "https://bioguide.congress.gov/bioguide/photo/{}/{normalized}.jpg",
        initial.to_ascii_uppercase()
    ))
}

// ── Congress.gov Bills ────────────────────────────────────────────────────

async fn cmd_congress_bills(repo: &Repository, congress: u32, limit: u32) {
    let api_key = match std::env::var("CONGRESS_GOV_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => {
            eprintln!("CONGRESS_GOV_API_KEY not set, marking source_run as auth_missing");
            let run_id = repo
                .create_source_run(
                    SOURCE_CONGRESS_GOV,
                    &format!("/v3/bill?congress={}", congress),
                    serde_json::json!({ "congress": congress, "limit": limit }),
                )
                .await
                .expect("Failed to create source_run");
            repo.finish_source_run(
                run_id,
                "auth_missing",
                0,
                0,
                Some("CONGRESS_GOV_API_KEY not set"),
            )
            .await
            .expect("Failed to finish auth_missing source_run");
            return;
        }
    };

    let run_id = repo
        .create_source_run(
            SOURCE_CONGRESS_GOV,
            &format!("/v3/bill?congress={}", congress),
            serde_json::json!({ "congress": congress, "limit": limit }),
        )
        .await
        .expect("Failed to create source_run");

    let result = try_congress_bills(repo, run_id, &api_key, congress, limit).await;
    finish_api_run(repo, run_id, result).await;
}

async fn try_congress_bills(
    repo: &Repository,
    run_id: uuid::Uuid,
    api_key: &str,
    congress: u32,
    limit: u32,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    let client = congress_api::Client::new(api_key.to_string());
    let query = congress_api::query::BillQuery::default()
        .with_congress(congress)
        .with_limit(limit);
    let resp = client.get_bills(&query).await?;

    let mut seen = 0i64;
    let mut written = 0i64;

    for bill in &resp.data {
        seen += 1;

        let bill_number: i32 = bill.number.parse().unwrap_or(0);
        let bill_type_lower = bill.bill_type.to_lowercase();
        let bill_id = schema::build_bill_id(congress as i32, &bill_type_lower, bill_number);

        let introduced_date = bill
            .introduced_date
            .as_deref()
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

        let sponsor_bioguide = bill.sponsor.as_ref().map(|s| s.bioguide_id.as_str());

        repo.upsert_bill(BillUpsert {
            congress: congress as i32,
            bill_type: &bill_type_lower,
            bill_number,
            bill_id: &bill_id,
            title: &bill.title,
            introduced_date,
            origin_chamber: Some(&normalize_chamber(&bill.chamber)),
            policy_area: None,
            latest_action_date: None,
            latest_action_text: None,
            status: "introduced",
            url: bill.url.as_deref(),
            source_run_id: Some(run_id),
        })
        .await?;
        written += 1;

        // Sponsor
        repo.upsert_bill_sponsor(BillSponsorUpsert {
            bill_id: &bill_id,
            bioguide_id: sponsor_bioguide,
            sponsor_type: "sponsor",
            sponsorship_date: introduced_date,
            is_original_cosponsor: false,
            source_run_id: Some(run_id),
        })
        .await?;
        written += 1;

        // Cosponsors
        if let Some(cosponsors) = &bill.cosponsors {
            for cosp in cosponsors {
                repo.upsert_bill_sponsor(BillSponsorUpsert {
                    bill_id: &bill_id,
                    bioguide_id: Some(&cosp.bioguide_id),
                    sponsor_type: "cosponsor",
                    sponsorship_date: None,
                    is_original_cosponsor: false,
                    source_run_id: Some(run_id),
                })
                .await?;
                written += 1;
            }
        }
    }

    Ok((seen, written))
}

// ── Congress.gov Votes ────────────────────────────────────────────────────

async fn cmd_congress_votes(repo: &Repository, congress: u32, chamber: &str, limit: u32) {
    let api_key = match std::env::var("CONGRESS_GOV_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => {
            eprintln!("CONGRESS_GOV_API_KEY not set, marking source_run as auth_missing");
            let run_id = repo
                .create_source_run(
                    SOURCE_CONGRESS_GOV,
                    &format!("/v3/vote?congress={}&chamber={}", congress, chamber),
                    serde_json::json!({ "congress": congress, "chamber": chamber, "limit": limit }),
                )
                .await
                .expect("Failed to create source_run");
            repo.finish_source_run(
                run_id,
                "auth_missing",
                0,
                0,
                Some("CONGRESS_GOV_API_KEY not set"),
            )
            .await
            .expect("Failed to finish auth_missing source_run");
            return;
        }
    };

    let run_id = repo
        .create_source_run(
            SOURCE_CONGRESS_GOV,
            &format!("/v3/vote?congress={}&chamber={}", congress, chamber),
            serde_json::json!({ "congress": congress, "chamber": chamber, "limit": limit }),
        )
        .await
        .expect("Failed to create source_run");

    let result = try_congress_votes(repo, run_id, &api_key, congress, chamber, limit).await;
    finish_api_run(repo, run_id, result).await;
}

async fn try_congress_votes(
    repo: &Repository,
    run_id: uuid::Uuid,
    api_key: &str,
    congress: u32,
    chamber: &str,
    limit: u32,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    let client = congress_api::Client::new(api_key.to_string());
    let query = congress_api::query::VoteQuery::default()
        .with_congress(congress)
        .with_chamber(chamber.to_string())
        .with_limit(limit);
    let resp = client.get_votes(&query).await?;

    let mut seen = 0i64;
    let mut written = 0i64;

    for vote in &resp.data {
        seen += 1;

        let norm_chamber = normalize_chamber(chamber);
        let vote_id = schema::build_vote_id(congress as i32, &norm_chamber, vote.roll_call as i32);
        let vote_date = NaiveDate::parse_from_str(&vote.date, "%Y-%m-%d").ok();

        repo.upsert_roll_call_vote(RollCallVoteUpsert {
            vote_id: &vote_id,
            congress: congress as i32,
            chamber: &norm_chamber,
            session: vote.session.parse::<i32>().ok(),
            roll_number: vote.roll_call as i32,
            vote_date,
            question: &vote.question,
            description: &vote.result,
            result: &vote.result,
            bill_id: vote.bill.as_deref(),
            source_url: None,
            source_run_id: Some(run_id),
        })
        .await?;
        written += 1;

        // Member-level vote positions (may be empty if Congress.gov doesn't expose them)
        for vd in &vote.votes {
            repo.upsert_member_vote(
                &vote_id,
                &vd.member_bioguide_id,
                &normalize_vote_position(&vd.vote),
                Some(&normalize_party(&vd.party)),
                Some(&normalize_state(&vd.state)),
                Some(run_id),
            )
            .await?;
            written += 1;
        }
    }

    Ok((seen, written))
}

// ── FEC Candidates ────────────────────────────────────────────────────────

async fn cmd_fec_candidates(repo: &Repository, cycle: u32, limit: u32) {
    let api_key = resolve_fec_api_key();
    let run_id = repo
        .create_source_run(
            SOURCE_OPENFEC,
            "/v1/candidates",
            serde_json::json!({ "cycle": cycle, "limit": limit }),
        )
        .await
        .expect("Failed to create source_run");

    let result = try_fec_candidates(repo, run_id, &api_key, cycle, limit).await;
    finish_api_run(repo, run_id, result).await;
}

async fn try_fec_candidates(
    repo: &Repository,
    run_id: uuid::Uuid,
    api_key: &str,
    cycle: u32,
    limit: u32,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    let client = openfec_api::Client::new(api_key.to_string());
    let mut seen = 0i64;
    let mut written = 0i64;

    let mut page = 1u32;
    while seen < i64::from(limit) {
        let remaining = limit.saturating_sub(seen as u32);
        let query = openfec_api::query::CandidateQuery::default()
            .with_cycle(cycle)
            .with_limit(remaining.min(100))
            .with_page(page);
        let resp = client.get_candidates(&query).await?;
        if resp.data.is_empty() {
            break;
        }

        for candidate in &resp.data {
            seen += 1;

            // Resolve candidate_id to bioguide_id via member_identifiers
            let bioguide_id = repo
                .find_member_by_identifier(schema::SCHEME_FEC, &candidate.candidate_id)
                .await?;

            let first_file = candidate
                .first_file_date
                .as_deref()
                .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
            let last_file = candidate
                .last_file_date
                .as_deref()
                .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

            repo.upsert_fec_candidate(FecCandidateUpsert {
                candidate_id: &candidate.candidate_id,
                bioguide_id: bioguide_id.as_deref(),
                name: &candidate.name,
                party: candidate.party.as_deref().map(normalize_party).as_deref(),
                state: candidate.state.as_deref().map(normalize_state).as_deref(),
                district: candidate.district.as_deref(),
                office: candidate.office.as_deref(),
                incumbent_challenge: candidate.incumbent_challenge.as_deref(),
                principal_committee_id: None,
                active_through: candidate.active_through,
                first_file_date: first_file,
                last_file_date: last_file,
                source_run_id: Some(run_id),
            })
            .await?;
            written += 1;

            // If no bioguide_id was found, queue for resolution
            if bioguide_id.is_none() {
                let reason = format!(
                    "FEC candidate {} ({}) not in member_identifiers for scheme=fec",
                    candidate.candidate_id, candidate.name
                );
                repo.queue_entity_resolution(EntityResolutionQueueInput {
                    entity_type: schema::ENTITY_TYPE_CANDIDATE,
                    source_scheme: schema::SCHEME_FEC,
                    source_value: &candidate.candidate_id,
                    candidate_bioguide_id: None,
                    confidence_score: 0.0,
                    reason: &reason,
                    raw_json: serde_json::json!(candidate),
                    source_run_id: Some(run_id),
                })
                .await?;
                written += 1;
            }
        }

        if page >= resp.pagination.pages || seen >= i64::from(limit) {
            break;
        }
        page += 1;
    }

    Ok((seen, written))
}

// ── FEC Committees ────────────────────────────────────────────────────────

async fn cmd_fec_committees(repo: &Repository, q: &str, limit: u32) {
    let api_key = resolve_fec_api_key();
    let run_id = repo
        .create_source_run(
            SOURCE_OPENFEC,
            &format!("/v1/committees?q={}", q),
            serde_json::json!({ "q": q, "limit": limit }),
        )
        .await
        .expect("Failed to create source_run");

    let result = try_fec_committees(repo, run_id, &api_key, q, limit).await;
    finish_api_run(repo, run_id, result).await;
}

async fn try_fec_committees(
    repo: &Repository,
    run_id: uuid::Uuid,
    api_key: &str,
    q: &str,
    limit: u32,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    let client = openfec_api::Client::new(api_key.to_string());
    let query = openfec_api::query::CommitteeQuery::default()
        .with_q(q.to_string())
        .with_limit(limit);
    let resp = client.get_committees(&query).await?;

    let mut seen = 0i64;
    let mut written = 0i64;

    for committee in &resp.data {
        seen += 1;

        let sponsor_ids = committee
            .sponsor_candidate_ids
            .as_ref()
            .map(|ids| serde_json::to_value(ids).unwrap_or_default())
            .unwrap_or(serde_json::Value::Array(vec![]));

        repo.upsert_fec_committee(FecCommitteeUpsert {
            committee_id: &committee.committee_id,
            name: &committee.name,
            committee_type: committee.committee_type.as_deref(),
            committee_type_full: committee.committee_type_full.as_deref(),
            designation: committee.designation.as_deref(),
            designation_full: committee.designation_full.as_deref(),
            party: committee.party.as_deref().map(normalize_party).as_deref(),
            state: committee.state.as_deref().map(normalize_state).as_deref(),
            treasurer_name: committee.treasurer_name.as_deref(),
            affiliated_committee_name: committee.affiliated_committee_name.as_deref(),
            sponsor_candidate_ids: sponsor_ids,
            source_run_id: Some(run_id),
        })
        .await?;
        written += 1;
    }

    Ok((seen, written))
}

// ── FEC Bulk ZIP ingestion ─────────────────────────────────────────────────

/// Download FEC bulk ZIPs, stream congressional receipts, and rebuild rankings.
async fn cmd_fec_bulk(
    repo: &Repository,
    cycles: &[u32],
    force: bool,
    reparse: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    for &cycle in cycles {
        let run_id = repo
            .create_source_run(
                SOURCE_OPENFEC,
                &format!("/files/bulk-downloads/{cycle}"),
                serde_json::json!({ "cycle": cycle, "force": force, "reparse": reparse }),
            )
            .await?;
        match intel_backend::fec_bulk::pipeline::run_cycle(repo, cycle, force, reparse, run_id)
            .await
        {
            Ok(stats) => {
                let status = if stats.rows_skipped > 0 {
                    "partial"
                } else {
                    "success"
                };
                repo.finish_source_run(
                    run_id,
                    status,
                    stats.rows_seen,
                    stats.rows_written,
                    (stats.rows_skipped > 0)
                        .then(|| {
                            format!(
                                "{} source rows were malformed or unresolved; inspect FEC coverage tables",
                                stats.rows_skipped
                            )
                        })
                        .as_deref(),
                )
                .await?;
            }
            Err(error) => {
                repo.finish_source_run(run_id, "failed", 0, 0, Some(&error.to_string()))
                    .await?;
                return Err(error.into());
            }
        }
    }

    info!("FEC bulk ingest complete");
    Ok(())
}

async fn cmd_fec_disbursements(
    repo: &Repository,
    cycles: &[u32],
    force: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    for &cycle in cycles {
        let run_id = repo
            .create_source_run(
                SOURCE_OPENFEC,
                &format!("/files/bulk-downloads/{cycle}/operating-disbursements"),
                serde_json::json!({ "cycle": cycle, "force": force }),
            )
            .await?;
        match intel_backend::fec_bulk::pipeline::run_disbursements(repo, cycle, force, run_id).await
        {
            Ok(stats) => {
                let status = if stats.rows_skipped > 0 {
                    "partial"
                } else {
                    "success"
                };
                repo.finish_source_run(
                    run_id,
                    status,
                    stats.rows_seen,
                    stats.rows_written,
                    (stats.rows_skipped > 0)
                        .then(|| format!("{} malformed Schedule B rows", stats.rows_skipped))
                        .as_deref(),
                )
                .await?;
            }
            Err(error) => {
                repo.finish_source_run(run_id, "failed", 0, 0, Some(&error.to_string()))
                    .await?;
                return Err(error.into());
            }
        }
    }
    Ok(())
}

async fn cmd_fec_rebuild_rankings(
    repo: &Repository,
    cycles: &[i32],
) -> Result<(), Box<dyn std::error::Error>> {
    for &cycle in cycles {
        let run_id = repo
            .create_source_run(
                SOURCE_RELATIONSHIP_DERIVATION,
                "/derived/fec-rankings",
                serde_json::json!({ "cycle": cycle }),
            )
            .await?;
        let result: Result<(i64, i64), sqlx::Error> = async {
            let mut transaction = repo.pool().begin().await?;
            let donor_rows =
                intel_backend::fec_bulk::rankings::build_donor_rankings(&mut transaction, cycle)
                    .await?;
            let committee_rows = intel_backend::fec_bulk::rankings::build_committee_rankings(
                &mut transaction,
                cycle,
            )
            .await?;
            intel_backend::fec_bulk::rankings::refresh_funding_mv(&mut transaction).await?;
            transaction.commit().await?;
            Ok((donor_rows, committee_rows))
        }
        .await;

        match result {
            Ok((donor_rows, committee_rows)) => {
                repo.finish_source_run(
                    run_id,
                    "success",
                    donor_rows + committee_rows,
                    donor_rows + committee_rows,
                    None,
                )
                .await?;
            }
            Err(error) => {
                repo.finish_source_run(run_id, "failed", 0, 0, Some(&error.to_string()))
                    .await?;
                return Err(error.into());
            }
        }
    }
    Ok(())
}

async fn cmd_fec_refresh_identities(
    repo: &Repository,
    cycles: &[u32],
) -> Result<(), Box<dyn std::error::Error>> {
    for &cycle in cycles {
        let run_id = repo
            .create_source_run(
                SOURCE_OPENFEC,
                "/files/bulk-downloads/identity-refresh",
                serde_json::json!({ "cycle": cycle }),
            )
            .await?;
        match intel_backend::fec_bulk::pipeline::refresh_identities_from_current_archives(
            repo, cycle, run_id,
        )
        .await
        {
            Ok(stats) => {
                let status = if stats.rows_skipped > 0 {
                    "partial"
                } else {
                    "success"
                };
                repo.finish_source_run(
                    run_id,
                    status,
                    stats.rows_seen,
                    stats.rows_written,
                    (stats.rows_skipped > 0)
                        .then(|| format!("{} identity rows remain unresolved", stats.rows_skipped))
                        .as_deref(),
                )
                .await?;
            }
            Err(error) => {
                repo.finish_source_run(run_id, "failed", 0, 0, Some(&error.to_string()))
                    .await?;
                return Err(error.into());
            }
        }
    }
    Ok(())
}

// ── FEC Transactions (receipts) ───────────────────────────────────────────

async fn cmd_fec_transactions(repo: &Repository, cycle: u32, committee_id: &str, limit: u32) {
    let api_key = resolve_fec_api_key();
    let run_id = repo
        .create_source_run(
            SOURCE_OPENFEC,
            &format!(
                "/v1/schedules/schedule_a?committee_id={}&cycle={}",
                committee_id, cycle
            ),
            serde_json::json!({ "cycle": cycle, "committee_id": committee_id, "limit": limit }),
        )
        .await
        .expect("Failed to create source_run");

    let result = try_fec_transactions(repo, run_id, &api_key, cycle, committee_id, limit).await;
    finish_api_run(repo, run_id, result).await;
}

async fn try_fec_transactions(
    repo: &Repository,
    run_id: uuid::Uuid,
    api_key: &str,
    cycle: u32,
    committee_id: &str,
    limit: u32,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    let client = openfec_api::Client::new(api_key.to_string());
    let query = openfec_api::query::ReceiptQuery::default()
        .with_committee_id(committee_id.to_string())
        .with_cycle(cycle)
        .with_limit(limit);
    let resp = client.get_receipts(&query).await?;

    let mut seen = 0i64;
    let mut written = 0i64;

    for receipt in &resp.data {
        seen += 1;

        // Build a deterministic transaction ID
        let tx_id = format!(
            "receipt-{}-{}-{}",
            receipt.committee_id.as_deref().unwrap_or("?"),
            receipt.contribution_date.as_deref().unwrap_or("unknown"),
            receipt.contributor_name.as_deref().unwrap_or("anon"),
        );

        let tx_date = receipt
            .transaction_date
            .as_deref()
            .or(receipt.contribution_date.as_deref())
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

        let bioguide_id = match receipt.candidate_id.as_deref() {
            Some(cid) => repo
                .find_member_by_identifier(schema::SCHEME_FEC, cid)
                .await
                .unwrap_or(None),
            None => None,
        };

        let result = repo
            .upsert_fec_transaction(FecTransactionUpsert {
                transaction_id: &tx_id,
                transaction_type: "receipt",
                committee_id: receipt.committee_id.as_deref(),
                candidate_id: receipt.candidate_id.as_deref(),
                bioguide_id: bioguide_id.as_deref(),
                contributor_name: receipt.contributor_name.as_deref(),
                contributor_committee_id: receipt.contributor_committee_id.as_deref(),
                recipient_name: receipt.recipient_name.as_deref(),
                amount: receipt.contribution_amount.unwrap_or(0.0),
                transaction_date: tx_date,
                cycle: Some(cycle as i32),
                support_oppose_indicator: receipt.support_oppose_indicator.as_deref(),
                employer: receipt.contributor_employer.as_deref(),
                occupation: receipt.contributor_occupation.as_deref(),
                purpose: receipt.purpose.as_deref(),
                memo_text: receipt.memo_text.as_deref(),
                source_url: receipt.url.as_deref(),
                raw_json: serde_json::to_value(receipt)?,
                source_run_id: Some(run_id),
            })
            .await;
        match result {
            Ok(()) => {
                written += 1;
            }
            Err(e) => {
                tracing::warn!("Skipping receipt {}: {}", tx_id, e);
            }
        }
    }

    Ok((seen, written))
}

// ── FEC Independent Expenditures ──────────────────────────────────────────

async fn cmd_fec_independent_expenditures(
    repo: &Repository,
    cycle: u32,
    committee_id: &str,
    limit: u32,
) {
    let api_key = resolve_fec_api_key();
    let run_id = repo
        .create_source_run(
            SOURCE_OPENFEC,
            &format!(
                "/v1/schedules/schedule_e?committee_id={}&cycle={}",
                committee_id, cycle
            ),
            serde_json::json!({ "cycle": cycle, "committee_id": committee_id, "limit": limit }),
        )
        .await
        .expect("Failed to create source_run");

    let result =
        try_fec_independent_expenditures(repo, run_id, &api_key, cycle, committee_id, limit).await;
    finish_api_run(repo, run_id, result).await;
}

async fn try_fec_independent_expenditures(
    repo: &Repository,
    run_id: uuid::Uuid,
    api_key: &str,
    cycle: u32,
    committee_id: &str,
    limit: u32,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    let client = openfec_api::Client::new(api_key.to_string());
    let query = openfec_api::query::IndependentExpenditureQuery::default()
        .with_committee_id(committee_id.to_string())
        .with_cycle(cycle)
        .with_limit(limit);
    let resp = client.get_schedule_e(&query).await?;

    let mut seen = 0i64;
    let mut written = 0i64;

    for ie in &resp.data {
        seen += 1;

        let tx_id = format!(
            "ie-{}-{}-{}",
            ie.committee_id.as_deref().unwrap_or("?"),
            ie.expenditure_date.as_deref().unwrap_or("unknown"),
            ie.candidate_id.as_deref().unwrap_or("?"),
        );

        let tx_date = ie
            .expenditure_date
            .as_deref()
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

        let bioguide_id = match ie.candidate_id.as_deref() {
            Some(cid) => repo
                .find_member_by_identifier(schema::SCHEME_FEC, cid)
                .await
                .unwrap_or(None),
            None => None,
        };

        repo.upsert_fec_transaction(FecTransactionUpsert {
            transaction_id: &tx_id,
            transaction_type: "independent_expenditure",
            committee_id: ie.committee_id.as_deref(),
            candidate_id: ie.candidate_id.as_deref(),
            bioguide_id: bioguide_id.as_deref(),
            contributor_name: ie.payee_name.as_deref(),
            contributor_committee_id: ie.committee_id.as_deref(),
            recipient_name: None,
            amount: ie.expenditure_amount.unwrap_or(0.0),
            transaction_date: tx_date,
            cycle: Some(cycle as i32),
            support_oppose_indicator: ie.support_oppose_indicator.as_deref(),
            employer: None,
            occupation: None,
            purpose: ie.purpose.as_deref(),
            memo_text: None,
            source_url: None,
            raw_json: serde_json::to_value(ie)?,
            source_run_id: Some(run_id),
        })
        .await?;
        written += 1;
    }

    Ok((seen, written))
}

// ── Lobbying Filings ──────────────────────────────────────────────────────

#[derive(Debug)]
struct LobbyingIngestError {
    seen: i64,
    written: i64,
    message: String,
}

impl LobbyingIngestError {
    fn at(seen: i64, written: i64, error: impl std::fmt::Display) -> Self {
        Self {
            seen,
            written,
            message: error.to_string(),
        }
    }
}

impl std::fmt::Display for LobbyingIngestError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for LobbyingIngestError {}

fn activity_lobbyist_identity(
    entries: &[lobbying_client::types::LobbyistActivityEntry],
) -> serde_json::Value {
    let mut identity = entries
        .iter()
        .map(|entry| {
            let lobbyist = entry.lobbyist.as_ref();
            let person = match lobbyist.and_then(|value| value.id) {
                Some(id) => serde_json::json!({ "id": id }),
                None => serde_json::json!({
                    "first_name": lobbyist
                        .and_then(|value| value.first_name.as_deref())
                        .unwrap_or_default().trim().to_lowercase(),
                    "middle_name": lobbyist
                        .and_then(|value| value.middle_name.as_deref())
                        .unwrap_or_default().trim().to_lowercase(),
                    "last_name": lobbyist
                        .and_then(|value| value.last_name.as_deref())
                        .unwrap_or_default().trim().to_lowercase(),
                    "suffix": lobbyist
                        .and_then(|value| value.suffix.as_deref())
                        .unwrap_or_default().trim().to_lowercase(),
                }),
            };
            serde_json::json!({
                "person": person,
                "covered_position": entry.covered_position,
                "is_new": entry.new,
            })
        })
        .collect::<Vec<_>>();
    identity.sort_by_key(serde_json::Value::to_string);
    serde_json::Value::Array(identity)
}

fn government_entity_identity(
    entries: &[lobbying_client::types::GovernmentEntity],
) -> serde_json::Value {
    let mut identity = entries
        .iter()
        .map(|entity| match entity.id {
            Some(id) => serde_json::json!({ "id": id }),
            None => serde_json::json!({
                "name": entity.name.as_deref().unwrap_or_default().trim().to_lowercase()
            }),
        })
        .collect::<Vec<_>>();
    identity.sort_by_key(serde_json::Value::to_string);
    identity.dedup();
    serde_json::Value::Array(identity)
}

async fn cmd_lobbying_filings(
    repo: &Repository,
    year: u32,
    start_page: u32,
    run_correlation_id: Option<&str>,
    page_size: u32,
    limit_pages: u32,
) {
    let lda_key = std::env::var("SENATE_LDA_API_KEY").ok();
    let run_id = repo
        .create_source_run(
            SOURCE_LDA,
            &format!("/filings?filing_year={}", year),
            serde_json::json!({
                "year": year,
                "start_page": start_page,
                "run_correlation_id": run_correlation_id,
                "page_size": page_size,
                "limit_pages": limit_pages
            }),
        )
        .await
        .expect("Failed to create source_run");

    let result = try_lobbying_filings(
        repo,
        run_id,
        lda_key,
        year,
        start_page,
        page_size,
        limit_pages,
    )
    .await;
    match result {
        Ok((seen, written, complete)) => {
            let (status, error) = if complete {
                ("success", None)
            } else {
                (
                    "partial",
                    Some("page limit reached while the provider still had more filings"),
                )
            };
            repo.finish_source_run(run_id, status, seen, written, error)
                .await
                .expect("Failed to finish lobbying source_run");
        }
        Err(error) => {
            eprintln!("Lobbying ingest failed: {error}");
            repo.finish_source_run(
                run_id,
                "failed",
                error.seen,
                error.written,
                Some(&error.to_string()),
            )
            .await
            .expect("Failed to finish lobbying source_run");
            if std::env::var("INGEST_CONTINUE_ON_ERROR").as_deref() != Ok("1") {
                std::process::exit(1);
            }
        }
    }
}

async fn try_lobbying_filings(
    repo: &Repository,
    run_id: uuid::Uuid,
    lda_key: Option<String>,
    year: u32,
    start_page: u32,
    page_size: u32,
    limit_pages: u32,
) -> Result<(i64, i64, bool), LobbyingIngestError> {
    let authenticated = lda_key.is_some();
    let client = match lda_key {
        Some(k) => lobbying_client::LobbyingClient::with_key(k),
        None => lobbying_client::LobbyingClient::new(),
    };

    let mut seen = 0i64;
    let mut written = 0i64;
    macro_rules! progress {
        ($operation:expr) => {
            match $operation {
                Ok(value) => value,
                Err(error) => {
                    return Err(LobbyingIngestError {
                        seen,
                        written,
                        message: error.to_string(),
                    })
                }
            }
        };
    }

    let end_page = start_page.saturating_add(limit_pages);
    for page in start_page..end_page {
        let mut query = lobbying_client::types::FilingQuery::default()
            .with_year(year)
            .with_page_size(page_size);
        query.page = Some(page);

        let resp = progress!(client.get_filings(&query).await);
        seen += resp.results.len() as i64;

        for filing in &resp.results {
            let filing_uuid = match &filing.filing_uuid {
                Some(u) => u.clone(),
                None => continue,
            };

            // Registrant
            if let Some(reg) = &filing.registrant {
                if let Some(reg_id) = reg.id {
                    repo.upsert_lobbying_registrant(LobbyingRegistrantUpsert {
                        id: reg_id,
                        name: reg.name.as_deref().unwrap_or(""),
                        description: reg.description.as_deref(),
                        state: reg.state.as_deref(),
                        country: reg.country.as_deref(),
                        raw_json: progress!(serde_json::to_value(reg)),
                        source_run_id: Some(run_id),
                    })
                    .await
                    .map_err(|error| LobbyingIngestError::at(seen, written, error))?;
                    written += 1;
                }
            }

            // Client
            if let Some(cl) = &filing.client {
                if let Some(client_id) = cl.id {
                    repo.upsert_lobbying_client(
                        client_id,
                        cl.name.as_deref().unwrap_or(""),
                        cl.state.as_deref(),
                        cl.country.as_deref(),
                        progress!(serde_json::to_value(cl)),
                        Some(run_id),
                    )
                    .await
                    .map_err(|error| LobbyingIngestError::at(seen, written, error))?;
                    written += 1;
                }
            }

            // Filing
            let income = filing.income.as_deref().and_then(|s| s.parse::<f64>().ok());
            let expenses = filing
                .expenses
                .as_deref()
                .and_then(|s| s.parse::<f64>().ok());
            let dt_posted = filing
                .dt_posted
                .as_deref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&chrono::Utc));

            repo.upsert_lobbying_filing(LobbyingFilingUpsert {
                filing_uuid: &filing_uuid,
                filing_type: filing.filing_type.as_deref(),
                filing_year: Some(year as i32),
                filing_period: filing.filing_period.as_deref(),
                income,
                expenses,
                registrant_id: filing.registrant.as_ref().and_then(|r| r.id),
                client_id: filing.client.as_ref().and_then(|c| c.id),
                dt_posted,
                raw_json: progress!(serde_json::to_value(filing)),
                source_run_id: Some(run_id),
            })
            .await
            .map_err(|error| LobbyingIngestError::at(seen, written, error))?;
            written += 1;

            if let Some(lobbyists) = &filing.lobbyists {
                for lobbyist in lobbyists {
                    let (Some(lobbyist_id), Some(last_name)) =
                        (lobbyist.id, lobbyist.last_name.as_deref())
                    else {
                        continue;
                    };
                    repo.upsert_lobbying_lobbyist(LobbyingLobbyistUpsert {
                        id: lobbyist_id,
                        first_name: lobbyist.first_name.as_deref(),
                        middle_name: lobbyist.middle_name.as_deref(),
                        last_name,
                        suffix: lobbyist
                            .suffix_display
                            .as_deref()
                            .or(lobbyist.suffix.as_deref()),
                        raw_json: progress!(serde_json::to_value(lobbyist)),
                        source_run_id: Some(run_id),
                    })
                    .await
                    .map_err(|error| LobbyingIngestError::at(seen, written, error))?;
                    repo.link_lobbyist_to_filing(
                        &filing_uuid,
                        lobbyist_id,
                        None,
                        None,
                        Some(run_id),
                    )
                    .await
                    .map_err(|error| LobbyingIngestError::at(seen, written, error))?;
                    written += 2;
                }
            }

            // Activities
            if let Some(activities) = &filing.lobbying_activities {
                for activity in activities {
                    let gov_entities = government_entity_identity(
                        activity.government_entities.as_deref().unwrap_or_default(),
                    );
                    let lobbyist_identity = activity_lobbyist_identity(
                        activity.lobbyists.as_deref().unwrap_or_default(),
                    );
                    let activity_id = repo
                        .upsert_lobbying_activity(LobbyingActivityUpsert {
                            filing_uuid: &filing_uuid,
                            issue_code: activity.general_issue_code.as_deref(),
                            issue_display: activity.general_issue_code_display.as_deref(),
                            description: activity.description.as_deref(),
                            foreign_entity_issues: activity.foreign_entity_issues.as_deref(),
                            government_entities: gov_entities,
                            lobbyist_identity,
                            source_run_id: Some(run_id),
                        })
                        .await
                        .map_err(|error| LobbyingIngestError::at(seen, written, error))?;
                    written += 1;

                    if let Some(activity_lobbyists) = &activity.lobbyists {
                        for entry in activity_lobbyists {
                            let Some(lobbyist) = &entry.lobbyist else {
                                continue;
                            };
                            let (Some(lobbyist_id), Some(last_name)) =
                                (lobbyist.id, lobbyist.last_name.as_deref())
                            else {
                                continue;
                            };
                            repo.upsert_lobbying_lobbyist(LobbyingLobbyistUpsert {
                                id: lobbyist_id,
                                first_name: lobbyist.first_name.as_deref(),
                                middle_name: lobbyist.middle_name.as_deref(),
                                last_name,
                                suffix: lobbyist
                                    .suffix_display
                                    .as_deref()
                                    .or(lobbyist.suffix.as_deref()),
                                raw_json: progress!(serde_json::to_value(lobbyist)),
                                source_run_id: Some(run_id),
                            })
                            .await
                            .map_err(|error| LobbyingIngestError::at(seen, written, error))?;
                            repo.link_lobbyist_to_filing(
                                &filing_uuid,
                                lobbyist_id,
                                entry.covered_position.as_deref(),
                                entry.new,
                                Some(run_id),
                            )
                            .await
                            .map_err(|error| LobbyingIngestError::at(seen, written, error))?;
                            repo.link_lobbyist_to_activity(
                                activity_id,
                                lobbyist_id,
                                entry.covered_position.as_deref(),
                                entry.new,
                                Some(run_id),
                            )
                            .await
                            .map_err(|error| LobbyingIngestError::at(seen, written, error))?;
                            written += 3;
                        }
                    }
                }
            }
        }

        if resp.next.is_none() {
            return Ok((seen, written, true));
        }
        if page.saturating_add(1) < end_page {
            let delay_ms = if authenticated { 550 } else { 4_100 };
            tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
        }
    }

    Ok((seen, written, false))
}

// ── Voteview Data ─────────────────────────────────────────────────────────

async fn cmd_voteview(
    repo: &Repository,
    ingest_members: bool,
    ingest_votes: bool,
    ingest_rollcalls: bool,
) {
    let run_id = repo
        .create_source_run(
            SOURCE_VOTEVIEW,
            "voteview.com/data",
            serde_json::json!({ "members": ingest_members, "votes": ingest_votes, "rollcalls": ingest_rollcalls }),
        )
        .await
        .expect("Failed to create source_run");

    let result = try_voteview(repo, run_id, ingest_members, ingest_votes, ingest_rollcalls).await;
    finish_api_run(repo, run_id, result).await;
}

async fn try_voteview(
    repo: &Repository,
    run_id: uuid::Uuid,
    ingest_members: bool,
    ingest_votes: bool,
    ingest_rollcalls: bool,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    const TARGET_CONGRESS: i32 = 119;
    let client = reqwest::Client::new();
    let mut seen = 0i64;
    let mut written = 0i64;

    // Older importer versions used incorrect Voteview CSV indexes and could
    // queue invalid ICPSR resolutions. Rebuild this source deterministically.
    sqlx::query(
        "DELETE FROM entity_resolution_queue WHERE source_scheme = $1 AND reason LIKE 'Voteview %'",
    )
    .bind(schema::SCHEME_ICPSR)
    .execute(repo.pool())
    .await?;
    let identifier_rows: Vec<(String, String)> =
        sqlx::query_as("SELECT value, bioguide_id FROM member_identifiers WHERE scheme = $1")
            .bind(schema::SCHEME_ICPSR)
            .fetch_all(repo.pool())
            .await?;
    let icpsr_to_bioguide: HashMap<String, String> = identifier_rows.into_iter().collect();

    // 1. Members CSV — load ICPSR crosswalk
    if ingest_members {
        let url = "https://voteview.com/static/data/out/members/HS119_members.csv";
        let csv_text = client.get(url).send().await?.text().await?;
        let mut reader = csv::Reader::from_reader(csv_text.as_bytes());

        for result in reader.records() {
            let record = result?;
            let congress: i32 = record
                .get(0)
                .and_then(|value| value.parse().ok())
                .unwrap_or(0);
            if congress != TARGET_CONGRESS {
                continue;
            }
            seen += 1;

            let icpsr: &str = record.get(2).unwrap_or("");
            let chamber_code: &str = record.get(1).unwrap_or("");
            let state_code: &str = record.get(5).unwrap_or("");
            let district_code: &str = record.get(4).unwrap_or("");
            let party_code: &str = record.get(6).unwrap_or("");
            let nominate_dim1: Option<f64> = record.get(13).and_then(|v| v.parse().ok());
            let nominate_dim2: Option<f64> = record.get(14).and_then(|v| v.parse().ok());
            let bioname: &str = record.get(9).unwrap_or("");

            if icpsr.is_empty() {
                continue;
            }

            // Try to find by ICPSR
            let bioguide_id = icpsr_to_bioguide.get(icpsr).cloned();

            if let Some(bg) = bioguide_id {
                // Update nominate scores on the member
                sqlx::query(
                    "UPDATE members SET nominate_dim1 = COALESCE($1, nominate_dim1), nominate_dim2 = COALESCE($2, nominate_dim2) WHERE bioguide_id = $3",
                )
                .bind(nominate_dim1)
                .bind(nominate_dim2)
                .bind(&bg)
                .execute(repo.pool())
                .await?;
                written += 1;
            } else {
                // Queue for resolution
                repo.queue_entity_resolution(EntityResolutionQueueInput {
                    entity_type: schema::ENTITY_TYPE_MEMBER,
                    source_scheme: schema::SCHEME_ICPSR,
                    source_value: icpsr,
                    candidate_bioguide_id: None,
                    confidence_score: 0.0,
                    reason: &format!("Voteview member not matched: {} (ICPSR {})", bioname, icpsr),
                    raw_json: serde_json::json!({
                        "party": normalize_party(party_code),
                        "chamber": chamber_code,
                        "state": state_code,
                        "district": district_code,
                        "party": party_code,
                        "name": bioname,
                    }),
                    source_run_id: Some(run_id),
                })
                .await?;
                written += 1;
            }
        }
    }

    // 2. Roll-call votes
    if ingest_rollcalls {
        let url = "https://voteview.com/static/data/out/rollcalls/HS119_rollcalls.csv";
        let csv_text = client.get(url).send().await?.text().await?;
        let mut reader = csv::Reader::from_reader(csv_text.as_bytes());

        for result in reader.records() {
            let record = result?;
            seen += 1;

            let congress: i32 = record.get(0).and_then(|v| v.parse().ok()).unwrap_or(0);
            if congress != TARGET_CONGRESS {
                continue;
            }
            let chamber_code: &str = record.get(1).unwrap_or("");
            let roll_number: i32 = record.get(2).and_then(|v| v.parse().ok()).unwrap_or(0);
            let vote_date: Option<NaiveDate> = record
                .get(3)
                .and_then(|v| NaiveDate::parse_from_str(v, "%Y-%m-%d").ok());
            let question: &str = record.get(16).unwrap_or("");
            let description: &str = record.get(15).unwrap_or("");
            let result_text: &str = record.get(14).unwrap_or("");

            let chamber = normalize_chamber(chamber_code);

            let vote_id = schema::build_vote_id(congress, &chamber, roll_number);

            repo.upsert_roll_call_vote(RollCallVoteUpsert {
                vote_id: &vote_id,
                congress,
                chamber: &chamber,
                session: None,
                roll_number,
                vote_date,
                question,
                description,
                result: result_text,
                bill_id: None,
                source_url: Some(url),
                source_run_id: Some(run_id),
            })
            .await?;
            written += 1;
        }
    }

    // 3. Individual member votes
    if ingest_votes {
        let url = "https://voteview.com/static/data/out/votes/HS119_votes.csv";
        let csv_text = client.get(url).send().await?.text().await?;
        let mut reader = csv::Reader::from_reader(csv_text.as_bytes());

        for result in reader.records() {
            let record = result?;
            seen += 1;

            let congress: i32 = record.get(0).and_then(|v| v.parse().ok()).unwrap_or(0);
            if congress != TARGET_CONGRESS {
                continue;
            }
            let chamber_code: &str = record.get(1).unwrap_or("");
            let roll_number: i32 = record.get(2).and_then(|v| v.parse().ok()).unwrap_or(0);
            let icpsr: &str = record.get(3).unwrap_or("");
            let position: i32 = record.get(4).and_then(|v| v.parse().ok()).unwrap_or(0);

            let chamber = normalize_chamber(chamber_code);

            let vote_id = schema::build_vote_id(congress, &chamber, roll_number);

            let raw_cast = match position {
                1..=3 => "Yea",
                4..=6 => "Nay",
                7 => "Present",
                8 | 9 => "Not Voting",
                _ => "Unknown",
            };
            let cast_vote = normalize_vote_position(raw_cast);

            let bioguide_id = icpsr_to_bioguide.get(icpsr).cloned();

            if let Some(bg) = &bioguide_id {
                repo.upsert_member_vote(&vote_id, bg, &cast_vote, None, None, Some(run_id))
                    .await?;
                written += 1;
            } else {
                repo.queue_entity_resolution(EntityResolutionQueueInput {
                    entity_type: schema::ENTITY_TYPE_MEMBER,
                    source_scheme: schema::SCHEME_ICPSR,
                    source_value: icpsr,
                    candidate_bioguide_id: None,
                    confidence_score: 0.0,
                    reason: &format!(
                        "Voteview vote not matched: ICPSR {} on vote {}",
                        icpsr, vote_id
                    ),
                    raw_json: serde_json::json!({
                        "icpsr": icpsr,
                        "vote_id": vote_id,
                        "position": cast_vote,
                    }),
                    source_run_id: Some(run_id),
                })
                .await?;
                written += 1;
            }
        }
    }

    Ok((seen, written))
}

// ── Refresh Materialized Views ────────────────────────────────────────────

async fn cmd_refresh_materialized_views(repo: &Repository) {
    info!("Refreshing materialized views …");

    let views = [
        "member_funding_cycle_mv",
        "member_vote_summary_mv",
        "influence_network_member_mv",
    ];

    for view in &views {
        info!(view, "Refreshing materialized view");
        let result = sqlx::query(&format!("REFRESH MATERIALIZED VIEW CONCURRENTLY {}", view))
            .execute(repo.pool())
            .await;
        match result {
            Ok(_) => info!(view, "Refresh succeeded"),
            Err(e) => {
                // Try non-concurrent refresh as fallback
                eprintln!(
                    "Concurrent refresh failed for {}: {e}. Trying non-concurrent …",
                    view
                );
                match sqlx::query(&format!("REFRESH MATERIALIZED VIEW {}", view))
                    .execute(repo.pool())
                    .await
                {
                    Ok(_) => info!(view, "Non-concurrent refresh succeeded"),
                    Err(e2) => {
                        eprintln!("Failed to refresh materialized view {}: {e2}", view);
                    }
                }
            }
        }
    }

    info!("Cache should be invalidated after materialized view refresh");
}

// ── AllSmoke ──────────────────────────────────────────────────────────────

async fn cmd_all_smoke(repo: &Repository) {
    info!("Running all-smoke ingest sequence …");
    let mut failures = Vec::new();

    // 1. Members (current-only, limit 25)
    info!("[1/5] Members …");
    let run_id = repo
        .create_source_run(
            SOURCE_UNITEDSTATES,
            "legislators-current.json",
            serde_json::json!({ "current_only": true, "limit": 25 }),
        )
        .await
        .expect("Failed to create source_run");

    let r = try_members(repo, run_id, true, 25).await;
    match &r {
        Ok((seen, written)) => {
            info!(seen, written, "Members smoke complete");
            if *written < 20 {
                failures.push(format!("Only {} members written, expected >= 20", written));
            }
            if let Err(err) = repo
                .finish_source_run(run_id, "success", *seen, *written, None)
                .await
            {
                eprintln!("Failed to finish source_run {run_id}: {err}");
            }
        }
        Err(e) => {
            failures.push(format!("Members smoke failed: {e}"));
            if let Err(err) = repo
                .finish_source_run(run_id, "failed", 0, 0, Some(&e.to_string()))
                .await
            {
                eprintln!("Failed to finish source_run {run_id}: {err}");
            }
        }
    }

    // 2. Influence seeds
    info!("[2/5] Influence seeds …");
    let run_id2 = repo
        .create_source_run(SOURCE_MANUAL, "influence-seeds", serde_json::json!({}))
        .await
        .expect("Failed to create source_run");

    let r2 = try_influence_seeds(repo, run_id2).await;
    match &r2 {
        Ok((seen, written)) => {
            info!(seen, written, "Influence seeds smoke complete");
            // Verify aipac network exists
            let aipac = repo.get_influence_network("aipac").await;
            match aipac {
                Ok(Some(network)) => {
                    if network.committees.len() < 3 {
                        failures.push(format!(
                            "AIPAC network has {} committees, expected >= 3",
                            network.committees.len()
                        ));
                    }
                }
                Ok(None) => {
                    failures.push("AIPAC influence network not found after seed".to_string());
                }
                Err(e) => {
                    failures.push(format!("Failed to verify AIPAC network: {e}"));
                }
            }
            if let Err(err) = repo
                .finish_source_run(run_id2, "success", *seen, *written, None)
                .await
            {
                eprintln!("Failed to finish source_run {run_id2}: {err}");
            }
        }
        Err(e) => {
            failures.push(format!("Influence seeds smoke failed: {e}"));
            if let Err(err) = repo
                .finish_source_run(run_id2, "failed", 0, 0, Some(&e.to_string()))
                .await
            {
                eprintln!("Failed to finish source_run {run_id2}: {err}");
            }
        }
    }

    // 3. FEC committees (q="AMERICAN ISRAEL", limit=10)
    info!("[3/5] FEC committees …");
    let fec_key = resolve_fec_api_key();
    let run_id3 = repo
        .create_source_run(
            SOURCE_OPENFEC,
            "/v1/committees?q=AMERICAN ISRAEL",
            serde_json::json!({ "q": "AMERICAN ISRAEL", "limit": 10 }),
        )
        .await
        .expect("Failed to create source_run");

    let r3 = try_fec_committees(repo, run_id3, &fec_key, "AMERICAN ISRAEL", 10).await;
    match &r3 {
        Ok((seen, written)) => {
            info!(seen, written, "FEC committees smoke complete");
            if let Err(err) = repo
                .finish_source_run(run_id3, "success", *seen, *written, None)
                .await
            {
                eprintln!("Failed to finish source_run {run_id3}: {err}");
            }
        }
        Err(e) => {
            failures.push(format!("FEC committees smoke failed: {e}"));
            let status = "failed";
            if let Err(err) = repo
                .finish_source_run(run_id3, status, 0, 0, Some(&e.to_string()))
                .await
            {
                eprintln!("Failed to finish source_run {run_id3}: {err}");
            }
        }
    }

    // 4. Congress bills (congress=119, limit=10)
    info!("[4/5] Congress bills …");
    let cg_key = std::env::var("CONGRESS_GOV_API_KEY").unwrap_or_default();
    let run_id4 = repo
        .create_source_run(
            SOURCE_CONGRESS_GOV,
            "/v3/bill?congress=119",
            serde_json::json!({ "congress": 119, "limit": 10 }),
        )
        .await
        .expect("Failed to create source_run");

    if cg_key.is_empty() {
        failures.push("CONGRESS_GOV_API_KEY not set, skipping Congress bills smoke".to_string());
        repo.finish_source_run(
            run_id4,
            "auth_missing",
            0,
            0,
            Some("CONGRESS_GOV_API_KEY not set"),
        )
        .await
        .expect("Failed to finish auth_missing source_run");
    } else {
        let r4 = try_congress_bills(repo, run_id4, &cg_key, 119, 10).await;
        match r4 {
            Ok((seen, written)) => {
                info!(seen, written, "Congress bills smoke complete");
                if let Err(err) = repo
                    .finish_source_run(run_id4, "success", seen, written, None)
                    .await
                {
                    eprintln!("Failed to finish source_run {run_id4}: {err}");
                }
            }
            Err(e) => {
                failures.push(format!("Congress bills smoke failed: {e}"));
                if let Err(err) = repo
                    .finish_source_run(run_id4, "failed", 0, 0, Some(&e.to_string()))
                    .await
                {
                    eprintln!("Failed to finish source_run {run_id4}: {err}");
                }
            }
        }
    }

    // 5. Refresh materialized views
    info!("[5/5] Refresh materialized views …");
    cmd_refresh_materialized_views(repo).await;

    if failures.is_empty() {
        info!("All-smoke passed!");
    } else {
        eprintln!("All-smoke completed with {} failure(s):", failures.len());
        for f in &failures {
            eprintln!("  - {f}");
        }
        std::process::exit(1);
    }
}

async fn cmd_senate_efd(
    repo: &Repository,
    submitted_start_date: &str,
    submitted_end_date: &str,
    page_size: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    if !(1..=100).contains(&page_size) {
        return Err("Senate eFD page size must be between 1 and 100".into());
    }
    if !senate_efd::operator_terms_accepted(
        std::env::var(senate_efd::TERMS_ACCEPTANCE_ENV)
            .ok()
            .as_deref(),
    ) {
        return Err("SENATE_EFD_ACCEPT_TERMS=1 is required before querying Senate eFD".into());
    }
    let run_id = repo
        .create_source_run(
            "senate_efd",
            "/search/report/data/",
            serde_json::json!({
                "submitted_start_date": submitted_start_date,
                "submitted_end_date": submitted_end_date,
                "page_size": page_size,
                "pagination": "exhaustive",
            }),
        )
        .await?;
    let result = try_senate_efd(
        repo,
        run_id,
        submitted_start_date,
        submitted_end_date,
        page_size,
    )
    .await;
    match result {
        Ok((seen, written)) => {
            repo.finish_source_run(run_id, "success", seen, written, None)
                .await?;
            info!(reports = seen, written, "Senate eFD discovery complete");
            Ok(())
        }
        Err(error) => {
            repo.finish_source_run(run_id, "failed", 0, 0, Some(&error.to_string()))
                .await?;
            Err(error)
        }
    }
}

async fn try_senate_efd(
    repo: &Repository,
    run_id: uuid::Uuid,
    submitted_start_date: &str,
    submitted_end_date: &str,
    page_size: usize,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .user_agent("CongressTracker/1.0 (public-interest research)")
        .timeout(std::time::Duration::from_secs(60))
        .build()?;
    let home = client
        .get(senate_efd::HOME_URL)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;
    let agreement_value =
        senate_efd::extract_csrf_token(&home).ok_or("Senate eFD token missing")?;
    let agreement_field = ["csrf", "middleware", "token"].concat();
    client
        .post(senate_efd::HOME_URL)
        .form(&[
            ("prohibition_agreement", "1"),
            (agreement_field.as_str(), agreement_value.as_str()),
        ])
        .header("Referer", senate_efd::HOME_URL)
        .send()
        .await?
        .error_for_status()?;
    let header_name = ["X-CSRF", "Token"].concat();
    let mut progress = senate_efd::SenateDiscoveryProgress::default();
    let mut links = Vec::new();
    let mut written = 0i64;
    loop {
        let start = progress.next_start;
        let page_length = page_size;
        let form = vec![
            ("draw", "1".to_string()),
            ("start", start.to_string()),
            ("length", page_length.to_string()),
            ("report_types", "[7,11]".to_string()),
            ("filer_types", "[1,5]".to_string()),
            ("submitted_start_date", submitted_start_date.to_string()),
            ("submitted_end_date", submitted_end_date.to_string()),
            ("candidate_state", String::new()),
            ("senator_state", String::new()),
            ("office_id", String::new()),
            ("first_name", String::new()),
            ("last_name", String::new()),
        ];
        let payload_text = client
            .post(senate_efd::DATA_URL)
            .header(&header_name, &agreement_value)
            .header("Referer", "https://efdsearch.senate.gov/search/")
            .form(&form)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;
        let payload: serde_json::Value = serde_json::from_str(&payload_text)?;
        let payload_sha256 = format!("{:x}", Sha256::digest(payload_text.as_bytes()));
        sqlx::query(
            r#"INSERT INTO senate_efd_search_pages
               (submitted_start_date,submitted_end_date,page_start,page_length,
                raw_payload,raw_sha256,source_run_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT DO NOTHING"#,
        )
        .bind(submitted_start_date)
        .bind(submitted_end_date)
        .bind(start as i32)
        .bind(page_length as i32)
        .bind(&payload)
        .bind(&payload_sha256)
        .bind(run_id)
        .execute(repo.pool())
        .await?;

        let page = senate_efd::parse_discovery_page(&payload)
            .map_err(|error| format!("invalid Senate eFD discovery payload: {error}"))?;
        progress
            .observe_report_identities(&page.links)
            .map_err(|error| format!("incomplete Senate eFD discovery: {error}"))?;
        let complete = progress
            .observe_page(&page, page_length)
            .map_err(|error| format!("incomplete Senate eFD discovery: {error}"))?;
        let page_links = page.links;
        for link in &page_links {
            written += sqlx::query(
                r#"INSERT INTO senate_disclosure_reports
                   (source_report_id,filer_name,report_type,report_url,submitted_date,
                    raw_payload,raw_sha256)
                   VALUES ($1,$2,$3,$4,$5,$6,$7)
                   ON CONFLICT (source_report_id) DO UPDATE SET
                     filer_name=EXCLUDED.filer_name,report_type=EXCLUDED.report_type,
                     report_url=EXCLUDED.report_url,submitted_date=EXCLUDED.submitted_date,
                     raw_payload=EXCLUDED.raw_payload,
                     raw_sha256=EXCLUDED.raw_sha256,updated_at=now()"#,
            )
            .bind(&link.source_report_id)
            .bind(&link.filer_name)
            .bind(&link.report_type)
            .bind(&link.report_url)
            .bind(link.submitted_date)
            .bind(&payload)
            .bind(&payload_sha256)
            .execute(repo.pool())
            .await?
            .rows_affected() as i64;
        }
        links.extend(page_links);
        if complete {
            break;
        }
    }
    links.sort_by(|left, right| left.source_report_id.cmp(&right.source_report_id));
    links.dedup_by(|left, right| left.source_report_id == right.source_report_id);
    let storage = senate_efd::storage_dir();
    tokio::fs::create_dir_all(&storage).await?;
    for link in &links {
        let response = client
            .get(&link.report_url)
            .header("Referer", "https://efdsearch.senate.gov/search/")
            .send()
            .await?
            .error_for_status()?;
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("application/octet-stream")
            .to_string();
        let body = response.bytes().await?;
        if content_type.contains("html") {
            let html = String::from_utf8_lossy(&body);
            if senate_efd::looks_like_terms_page(&html) {
                return Err(format!(
                    "Senate eFD terms session expired before report {}",
                    link.source_report_id
                )
                .into());
            }
        }
        let content_sha256 = format!("{:x}", Sha256::digest(&body));
        let extension = if content_type.contains("pdf") {
            "pdf"
        } else {
            "html"
        };
        let report_dir = storage.join(&link.source_report_id);
        tokio::fs::create_dir_all(&report_dir).await?;
        let storage_key = report_dir.join(format!("{content_sha256}.{extension}"));
        if !storage_key.exists() {
            tokio::fs::write(&storage_key, &body).await?;
        }
        let document_id: i64 = sqlx::query_scalar(
            r#"INSERT INTO disclosure_documents
               (bioguide_id,chamber,report_type,filing_date,source,source_record_id,
                source_url,raw_sha256,raw_storage_key,parse_status,source_run_id)
               VALUES (NULL,'Senate',$1,$2,'senate_efd',$3,$4,$5,$6,'pending',$7)
               ON CONFLICT (source,source_record_id) DO UPDATE SET
                 filing_date=COALESCE(EXCLUDED.filing_date,disclosure_documents.filing_date),
                 source_url=EXCLUDED.source_url,raw_sha256=EXCLUDED.raw_sha256,
                 raw_storage_key=EXCLUDED.raw_storage_key,source_run_id=EXCLUDED.source_run_id
               RETURNING document_id"#,
        )
        .bind(&link.report_type)
        .bind(link.submitted_date)
        .bind(&link.source_report_id)
        .bind(&link.report_url)
        .bind(&content_sha256)
        .bind(storage_key.to_string_lossy().as_ref())
        .bind(run_id)
        .fetch_one(repo.pool())
        .await?;
        let document_version_id: i64 = sqlx::query_scalar(
            r#"INSERT INTO document_versions (document_id,sha256,byte_size,storage_key)
               VALUES ($1,$2,$3,$4)
               ON CONFLICT (document_id,sha256) DO UPDATE SET storage_key=EXCLUDED.storage_key
               RETURNING id"#,
        )
        .bind(document_id)
        .bind(&content_sha256)
        .bind(body.len() as i64)
        .bind(storage_key.to_string_lossy().as_ref())
        .fetch_one(repo.pool())
        .await?;
        let (report_status, parse_error) = if content_type.contains("html") {
            let html = String::from_utf8_lossy(&body);
            match senate_efd::parse_report_html_checked(&link.report_type, &html) {
                Ok(parsed) => {
                    let parsed_rows = senate_efd::persist_parsed_report(
                        repo.pool(),
                        document_id,
                        document_version_id,
                        link,
                        &parsed,
                    )
                    .await?;
                    written += parsed_rows;
                    if parsed_rows > 0 {
                        ("parsed", None::<String>)
                    } else {
                        (
                            "partial",
                            Some(
                                "recognized Senate report page produced no normalized rows"
                                    .to_string(),
                            ),
                        )
                    }
                }
                Err(error) => {
                    warn!(report_id = %link.source_report_id, %error, "Senate HTML report was not parseable");
                    ("partial", Some(error))
                }
            }
        } else if content_type.contains("pdf") {
            let pdf_path = storage_key.clone();
            let extracted = tokio::task::spawn_blocking(move || {
                ProcessCommand::new("pdftotext")
                    .args(["-layout"])
                    .arg(pdf_path)
                    .arg("-")
                    .output()
            })
            .await??;
            if !extracted.status.success() {
                (
                    "partial",
                    Some("pdftotext failed for Senate report".to_string()),
                )
            } else {
                let text = String::from_utf8_lossy(&extracted.stdout);
                match senate_efd::parse_report_text_checked(&link.report_type, &text) {
                    Ok(parsed) => {
                        let parsed_rows = senate_efd::persist_parsed_report(
                            repo.pool(),
                            document_id,
                            document_version_id,
                            link,
                            &parsed,
                        )
                        .await?;
                        written += parsed_rows;
                        if parsed_rows > 0 {
                            ("parsed", None::<String>)
                        } else {
                            (
                                "partial",
                                Some("Senate PDF produced no normalized rows".to_string()),
                            )
                        }
                    }
                    Err(error) => {
                        warn!(report_id = %link.source_report_id, %error, "Senate PDF report was not parseable");
                        ("partial", Some(error))
                    }
                }
            }
        } else {
            (
                "partial",
                Some("unsupported Senate report content type".to_string()),
            )
        };
        sqlx::query(
            r#"UPDATE senate_disclosure_reports
               SET status=$2,content_sha256=$3,content_type=$4,raw_storage_key=$5,
                   fetched_at=now(),document_id=$6,document_version_id=$7,parse_error=$8,
                   updated_at=now()
               WHERE source_report_id=$1"#,
        )
        .bind(&link.source_report_id)
        .bind(report_status)
        .bind(&content_sha256)
        .bind(&content_type)
        .bind(storage_key.to_string_lossy().as_ref())
        .bind(document_id)
        .bind(document_version_id)
        .bind(parse_error.as_deref())
        .execute(repo.pool())
        .await?;
        sqlx::query(
            "UPDATE disclosure_documents SET parse_status=$2,parse_error=$3 WHERE document_id=$1",
        )
        .bind(document_id)
        .bind(report_status)
        .bind(parse_error.as_deref())
        .execute(repo.pool())
        .await?;
    }
    sqlx::query(
        r#"WITH matches AS (
             SELECT report.id,MIN(member.bioguide_id) AS bioguide_id
             FROM senate_disclosure_reports report
             JOIN members member ON member.current_chamber='Senate'
              AND (
                regexp_replace(lower(report.filer_name),'[^a-z]','','g') =
                  regexp_replace(lower(member.official_full_name),'[^a-z]','','g')
                OR regexp_replace(lower(report.filer_name),'[^a-z]','','g') =
                  regexp_replace(lower(member.last_name || member.first_name),'[^a-z]','','g')
              )
             WHERE report.bioguide_id IS NULL
             GROUP BY report.id HAVING COUNT(*)=1
           ), updated AS (
             UPDATE senate_disclosure_reports report
             SET bioguide_id=matches.bioguide_id,updated_at=now()
             FROM matches WHERE report.id=matches.id
             RETURNING report.source_report_id,report.bioguide_id
           )
           UPDATE disclosure_documents document
           SET bioguide_id=updated.bioguide_id,chamber='Senate'
           FROM updated
           WHERE document.source='senate_efd'
             AND document.source_record_id=updated.source_report_id"#,
    )
    .execute(repo.pool())
    .await?;
    let discovered = progress.expected_total.unwrap_or_default() as i64;
    Ok((discovered, written))
}

async fn cmd_sec_asset_crosswalk(repo: &Repository) -> Result<(), Box<dyn std::error::Error>> {
    let user_agent = std::env::var("SEC_USER_AGENT")
        .map_err(|_| "SEC_USER_AGENT must identify a contact email before querying SEC data")?;
    let payload: serde_json::Value = reqwest::Client::builder()
        .user_agent(user_agent)
        .timeout(std::time::Duration::from_secs(60))
        .build()?
        .get("https://www.sec.gov/files/company_tickers_exchange.json")
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let run_id = repo
        .create_source_run(
            "sec",
            "/files/company_tickers_exchange.json",
            serde_json::json!({"purpose": "financial_asset_identity_resolution"}),
        )
        .await?;
    let companies = intel_backend::sec_assets::parse_company_tickers(&payload);
    let mut resolved = 0i64;
    for company in companies {
        let Some(asset_id): Option<i64> = sqlx::query_scalar(
            "SELECT id FROM financial_assets WHERE upper(ticker) = $1 ORDER BY id LIMIT 1",
        )
        .bind(&company.ticker)
        .fetch_optional(repo.pool())
        .await?
        else {
            continue;
        };
        sqlx::query(
            "UPDATE financial_assets SET exchange = $1, cik = $2, resolution_status = 'resolved', updated_at = now() WHERE id = $3",
        )
        .bind(company.exchange.as_deref())
        .bind(&company.cik)
        .bind(asset_id)
        .execute(repo.pool())
        .await?;
        sqlx::query(
            "INSERT INTO financial_asset_identifiers (asset_id, scheme, value, source) VALUES ($1, 'cik', $2, 'sec_company_tickers_exchange') ON CONFLICT (scheme, value) DO NOTHING",
        )
        .bind(asset_id)
        .bind(&company.cik)
        .execute(repo.pool())
        .await?;
        sqlx::query(
            "INSERT INTO financial_asset_aliases (asset_id, alias, source) VALUES ($1, $2, 'sec_company_tickers_exchange') ON CONFLICT DO NOTHING",
        )
        .bind(asset_id)
        .bind(&company.name)
        .execute(repo.pool())
        .await?;
        resolved += 1;
    }
    repo.finish_source_run(run_id, "success", resolved, resolved, None)
        .await?;
    info!(resolved, "SEC asset crosswalk complete");
    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────

/// Resolve the OpenFEC API key, returning empty if not set. Callers must
/// check the result and fail with a clear message if it's empty.
fn resolve_fec_api_key() -> String {
    std::env::var("OPENFEC_API_KEY").unwrap_or_default()
}

/// Finish a source run from a Result, printing errors and exiting on failure.
async fn finish_api_run(
    repo: &Repository,
    run_id: uuid::Uuid,
    result: Result<(i64, i64), Box<dyn std::error::Error>>,
) {
    match result {
        Ok((seen, written)) => {
            info!(seen, written, "Ingest complete");
            if let Err(err) = repo
                .finish_source_run(run_id, "success", seen, written, None)
                .await
            {
                eprintln!("Failed to finish source_run {run_id}: {err}");
            }
        }
        Err(e) => {
            eprintln!("Ingest failed: {e}");
            if let Err(err) = repo
                .finish_source_run(run_id, "failed", 0, 0, Some(&e.to_string()))
                .await
            {
                eprintln!("Failed to finish source_run {run_id}: {err}");
            }
            if std::env::var("INGEST_CONTINUE_ON_ERROR").as_deref() != Ok("1") {
                std::process::exit(1);
            }
        }
    }
}

// ── Congress.gov Amendments ────────────────────────────────────────────────

async fn cmd_congress_amendments(repo: &Repository, congress: u32, limit: u32) {
    let api_key = match std::env::var("CONGRESS_GOV_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => {
            eprintln!("CONGRESS_GOV_API_KEY not set, marking source_run as auth_missing");
            let run_id = repo
                .create_source_run(
                    SOURCE_CONGRESS_GOV,
                    &format!("/v3/bill/amendments?congress={}", congress),
                    serde_json::json!({"congress": congress, "limit": limit}),
                )
                .await
                .expect("Failed to create source_run");
            repo.finish_source_run(
                run_id,
                "auth_missing",
                0,
                0,
                Some("CONGRESS_GOV_API_KEY not set"),
            )
            .await
            .expect("Failed to finish");
            return;
        }
    };

    let run_id = repo
        .create_source_run(
            SOURCE_CONGRESS_GOV,
            &format!("/v3/bill/amendments?congress={}", congress),
            serde_json::json!({"congress": congress, "limit": limit}),
        )
        .await
        .expect("Failed to create source_run");
    let result = try_congress_amendments(repo, run_id, &api_key, congress, limit).await;
    finish_api_run(repo, run_id, result).await;
}

async fn try_congress_amendments(
    repo: &Repository,
    run_id: uuid::Uuid,
    api_key: &str,
    congress: u32,
    limit: u32,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    let client = congress_api::Client::new(api_key.to_string());
    let query = congress_api::query::BillQuery::default()
        .with_congress(congress)
        .with_limit(limit);
    let resp = client.get_bills(&query).await?;

    let mut seen = 0i64;
    let mut written = 0i64;

    for bill in &resp.data {
        let bill_number: i32 = bill.number.parse().unwrap_or(0);
        let bill_type_lower = bill.bill_type.to_lowercase();
        let bill_id = schema::build_bill_id(congress as i32, &bill_type_lower, bill_number);

        match client
            .get_bill_amendments(congress, &bill_type_lower, bill_number as u32)
            .await
        {
            Ok(amendments_resp) => {
                for amd in &amendments_resp.amendments {
                    seen += 1;
                    let introduced_date = amd
                        .introduced_date
                        .as_deref()
                        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
                    let latest_action_date = amd
                        .latest_action
                        .as_ref()
                        .and_then(|a| a.action_date.as_deref())
                        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
                    let latest_action_text =
                        amd.latest_action.as_ref().and_then(|a| a.text.as_deref());

                    repo.upsert_bill_amendment(BillAmendmentUpsert {
                        bill_id: &bill_id,
                        congress: congress as i32,
                        bill_type: &bill_type_lower,
                        bill_number,
                        amendment_number: amd.number.as_deref(),
                        description: amd.description.as_deref(),
                        amendment_type: amd.amendment_type.as_deref(),
                        sponsor_name: amd.sponsor_name.as_deref(),
                        sponsor_bioguide_id: amd.sponsor_bioguide_id.as_deref(),
                        introduced_date,
                        latest_action_date,
                        latest_action_text,
                        chamber: None,
                        status: "proposed",
                        source_run_id: Some(run_id),
                    })
                    .await?;
                    written += 1;
                }
            }
            Err(_) => {
                // Some bills may not have amendments — that's fine
            }
        }
    }

    Ok((seen, written))
}

// ── Lobbying Bill Links ────────────────────────────────────────────────────

async fn cmd_lobbying_bill_links(repo: &Repository, year: u32) {
    let run_id = repo
        .create_source_run(
            SOURCE_LDA,
            &format!("/lobbying-bill-links?year={}", year),
            serde_json::json!({"year": year}),
        )
        .await
        .expect("Failed to create source_run");
    let result = try_lobbying_bill_links(repo, run_id, year).await;
    finish_api_run(repo, run_id, result).await;
}

async fn try_lobbying_bill_links(
    repo: &Repository,
    run_id: uuid::Uuid,
    year: u32,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    #[derive(sqlx::FromRow)]
    struct ActivityRow {
        filing_uuid: String,
        description: Option<String>,
        issue_display: Option<String>,
        source_url: Option<String>,
        observed_at: Option<chrono::NaiveDate>,
    }

    let pool = repo.pool();
    let activities: Vec<ActivityRow> = sqlx::query_as(
        r#"SELECT la.filing_uuid, la.description, la.issue_display,
                  COALESCE(lf.raw_json->>'filing_document_url', lf.raw_json->>'url') AS source_url,
                  lf.dt_posted::date AS observed_at
           FROM lobbying_activities la
           JOIN lobbying_filings lf ON lf.filing_uuid = la.filing_uuid
           WHERE lf.filing_year = $1"#,
    )
    .bind(year as i32)
    .fetch_all(pool)
    .await?;

    #[derive(sqlx::FromRow)]
    struct BillIdRow {
        bill_id: String,
        bill_type: String,
        bill_number: i32,
    }

    let bills: Vec<BillIdRow> = sqlx::query_as("SELECT bill_id, bill_type, bill_number FROM bills")
        .fetch_all(pool)
        .await?;

    let mut seen = 0i64;
    let mut written = 0i64;

    for activity in &activities {
        let text = format!(
            "{} {}",
            activity.description.as_deref().unwrap_or(""),
            activity.issue_display.as_deref().unwrap_or("")
        );

        for bill in &bills {
            let patterns = build_bill_patterns(&bill.bill_type, bill.bill_number);
            for pattern in &patterns {
                if text.to_uppercase().contains(&pattern.to_uppercase()) {
                    seen += 1;
                    let object_key = format!("bill:{}", bill.bill_id);
                    repo.upsert_relationship_evidence(RelationshipEvidenceInsert {
                        subject_key: &activity.filing_uuid,
                        object_key: &object_key,
                        relation_type: "lobbied",
                        evidence_tier: "direct",
                        confidence: "medium",
                        source: "lda",
                        source_record_id: Some(&activity.filing_uuid),
                        source_url: activity.source_url.as_deref(),
                        observed_at: activity.observed_at,
                        details: serde_json::json!({
                            "matched_bill_text": pattern,
                            "description": activity.description,
                        }),
                        source_run_id: Some(run_id),
                    })
                    .await?;
                    written += 1;
                    break;
                }
            }
        }
    }

    Ok((seen, written))
}

/// Generate common bill text patterns for matching in lobbying descriptions.
fn build_bill_patterns(bill_type: &str, bill_number: i32) -> Vec<String> {
    let bt = bill_type.to_lowercase();
    let mut patterns = Vec::new();

    match bt.as_str() {
        "hr" => {
            patterns.push(format!("H.R. {}", bill_number));
            patterns.push(format!("HR {}", bill_number));
            patterns.push(format!("H R {}", bill_number));
        }
        "s" => {
            patterns.push(format!("S. {}", bill_number));
            patterns.push(format!("S {}", bill_number));
        }
        "hres" => {
            patterns.push(format!("H.Res. {}", bill_number));
            patterns.push(format!("H RES {}", bill_number));
            patterns.push(format!("H.RES. {}", bill_number));
        }
        "sres" => {
            patterns.push(format!("S.Res. {}", bill_number));
            patterns.push(format!("S RES {}", bill_number));
            patterns.push(format!("S.RES. {}", bill_number));
        }
        "hjres" => {
            patterns.push(format!("H.J.Res. {}", bill_number));
            patterns.push(format!("H J RES {}", bill_number));
        }
        "sjres" => {
            patterns.push(format!("S.J.Res. {}", bill_number));
            patterns.push(format!("S J RES {}", bill_number));
        }
        "hconres" => {
            patterns.push(format!("H.Con.Res. {}", bill_number));
            patterns.push(format!("H CON RES {}", bill_number));
        }
        "sconres" => {
            patterns.push(format!("S.Con.Res. {}", bill_number));
            patterns.push(format!("S CON RES {}", bill_number));
        }
        _ => {
            patterns.push(format!("{} {}", bt.to_uppercase(), bill_number));
        }
    }
    patterns
}

#[cfg(test)]
mod member_portrait_tests {
    use super::bioguide_portrait_url;

    #[test]
    fn builds_official_bioguide_portrait_urls() {
        assert_eq!(
            bioguide_portrait_url("A000371").as_deref(),
            Some("https://bioguide.congress.gov/bioguide/photo/A/A000371.jpg")
        );
        assert_eq!(bioguide_portrait_url("not-an-id"), None);
        assert_eq!(bioguide_portrait_url(""), None);
    }
}

#[cfg(test)]
mod lobbying_ingest_tests {
    use super::{activity_lobbyist_identity, government_entity_identity, LobbyingIngestError};
    use lobbying_client::types::LobbyistActivityEntry;

    fn entry(value: serde_json::Value) -> LobbyistActivityEntry {
        serde_json::from_value(value).expect("valid lobbyist fixture")
    }

    #[test]
    fn stable_lobbyist_ids_ignore_name_corrections_but_keep_role_identity() {
        let original = activity_lobbyist_identity(&[entry(serde_json::json!({
            "lobbyist": { "id": 7, "first_name": "Pat", "last_name": "Lee" },
            "covered_position": "Former staff",
            "new": false
        }))]);
        let corrected_name = activity_lobbyist_identity(&[entry(serde_json::json!({
            "lobbyist": { "id": 7, "first_name": "Patricia", "last_name": "Li" },
            "covered_position": "Former staff",
            "new": false
        }))]);
        let different_id = activity_lobbyist_identity(&[entry(serde_json::json!({
            "lobbyist": { "id": 8, "first_name": "Pat", "last_name": "Lee" },
            "covered_position": "Former staff",
            "new": false
        }))]);
        let different_role = activity_lobbyist_identity(&[entry(serde_json::json!({
            "lobbyist": { "id": 7, "first_name": "Pat", "last_name": "Lee" },
            "covered_position": "Former member",
            "new": true
        }))]);
        assert_eq!(original, corrected_name);
        assert_ne!(original, different_id);
        assert_ne!(original, different_role);
    }

    #[test]
    fn ingestion_errors_retain_progress_from_prior_committed_rows() {
        let error = LobbyingIngestError::at(125, 418, "provider timeout");
        assert_eq!(error.seen, 125);
        assert_eq!(error.written, 418);
        assert_eq!(error.to_string(), "provider timeout");
    }

    #[test]
    fn stable_government_ids_ignore_renames_but_fallback_names_remain_distinct() {
        let original: Vec<lobbying_client::types::GovernmentEntity> =
            serde_json::from_value(serde_json::json!([
                { "id": 4, "name": "Department of Energy" }
            ]))
            .expect("valid entity fixture");
        let renamed: Vec<lobbying_client::types::GovernmentEntity> =
            serde_json::from_value(serde_json::json!([
                { "id": 4, "name": "U.S. Department of Energy" }
            ]))
            .expect("valid entity fixture");
        let different_id: Vec<lobbying_client::types::GovernmentEntity> =
            serde_json::from_value(serde_json::json!([
                { "id": 5, "name": "Department of Energy" }
            ]))
            .expect("valid entity fixture");
        let fallback_name: Vec<lobbying_client::types::GovernmentEntity> =
            serde_json::from_value(serde_json::json!([
                { "name": " Department of Energy " }
            ]))
            .expect("valid entity fixture");
        let other_fallback: Vec<lobbying_client::types::GovernmentEntity> =
            serde_json::from_value(serde_json::json!([
                { "name": "Department of Commerce" }
            ]))
            .expect("valid entity fixture");

        assert_eq!(
            government_entity_identity(&original),
            government_entity_identity(&renamed)
        );
        assert_ne!(
            government_entity_identity(&original),
            government_entity_identity(&different_id)
        );
        assert_ne!(
            government_entity_identity(&fallback_name),
            government_entity_identity(&other_fallback)
        );
    }
}
