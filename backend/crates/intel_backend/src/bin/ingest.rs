//! Deterministic CLI ingest binary for the Congress data platform.
//!
//! Every subcommand connects to Postgres, runs migrations, starts a
//! `source_runs` row, processes data in batches of 500, then finishes
//! the source run with an accurate status and row counts.

use std::sync::Arc;
use std::{
    fs::File,
    io::{BufRead, BufReader},
    process::Command as ProcessCommand,
};

use capitoltrades_api::Query;
use chrono::NaiveDate;
use clap::{Parser, Subcommand};
use intel_backend::{
    cache::CacheLayer,
    db::Db,
    normalize::{normalize_chamber, normalize_party, normalize_state, normalize_vote_position},
    repository::{
        bills::{BillSponsorUpsert, BillUpsert},
        entity_resolution::EntityResolutionQueueInput,
        fec::{FecCandidateUpsert, FecCommitteeUpsert, FecTransactionUpsert},
        influence::{InfluenceNetworkCommitteeUpsert, InfluenceNetworkUpsert},
        lobbying::{LobbyingFilingUpsert, LobbyingRegistrantUpsert},
        members::{CommitteeAssignmentUpsert, MemberTermUpsert, MemberUpsert},
        votes::RollCallVoteUpsert,
        Repository,
    },
    schema::{
        self, SOURCE_CAPITOLTRADES, SOURCE_CONGRESS_GOV, SOURCE_LDA, SOURCE_MANUAL, SOURCE_OPENFEC,
        SOURCE_RELATIONSHIP_DERIVATION, SOURCE_UNITEDSTATES, SOURCE_VOTEVIEW,
    },
};
use sha2::{Digest, Sha256};
use tracing::info;

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
    /// Ingest lobbying filings
    LobbyingFilings {
        #[arg(long)]
        year: u32,
        #[arg(long, default_value = "50")]
        page_size: u32,
        #[arg(long, default_value = "5")]
        limit_pages: u32,
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
    /// Ingest CapitolTrades
    CapitolTrades {
        #[arg(long, default_value = "50")]
        limit: u32,
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
        Command::FecIndependentExpenditures {
            cycle,
            committee_id,
            limit,
        } => cmd_fec_independent_expenditures(&repo, *cycle, committee_id, *limit).await,
        Command::LobbyingFilings {
            year,
            page_size,
            limit_pages,
        } => cmd_lobbying_filings(&repo, *year, *page_size, *limit_pages).await,
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
        Command::CapitolTrades { limit } => cmd_capitol_trades(&repo, *limit).await,
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
            description: "Verified public FEC-linked AIPAC political spending entities. Opaque 501(c)(4) donor sources are not attributed.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for AMERICAN ISRAEL and UNITED DEMOCRACY PROJECT, verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "nra",
            display_name: "NRA / National Rifle Association",
            description: "NRA Political Victory Fund and affiliated NRA spending entities. Deterministic FEC entity resolution.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for NRA POLITICAL VICTORY FUND verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "planned-parenthood",
            display_name: "Planned Parenthood Action Fund",
            description: "Planned Parenthood Action Fund PAC and affiliated spending entities.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for PLANNED PARENTHOOD verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "afl-cio",
            display_name: "AFL-CIO / Committee on Political Education",
            description: "AFL-CIO COPE Political Contributions Committee and labor federation spending entities.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for AFL-CIO verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "chamber-of-commerce",
            display_name: "U.S. Chamber of Commerce",
            description: "U.S. Chamber of Commerce PAC and affiliated business advocacy spending.",
            category: "industry_pac",
            confidence: "verified",
            source_citation: "OpenFEC committee search for CHAMBER OF COMMERCE verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "koch-network",
            display_name: "Koch Network / Americans for Prosperity Action",
            description: "Americans for Prosperity Action (AFP Action) super PAC and affiliated Koch network spending entities.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for AMERICANS FOR PROSPERITY verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "emilys-list",
            display_name: "EMILY's List",
            description: "EMILY's List federal PAC supporting pro-choice Democratic women candidates.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for EMILY'S LIST verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "club-for-growth",
            display_name: "Club for Growth",
            description: "Club for Growth PAC and Club for Growth Action super PAC supporting fiscally conservative candidates.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for CLUB FOR GROWTH verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "lcv",
            display_name: "League of Conservation Voters",
            description: "LCV Action Fund and affiliated environmental advocacy spending entities.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for LEAGUE OF CONSERVATION VOTERS verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "nar",
            display_name: "National Association of Realtors",
            description: "Realtors Political Action Committee (RPAC) - one of the largest trade association PACs.",
            category: "industry_pac",
            confidence: "verified",
            source_citation: "OpenFEC committee search for REALTORS POLITICAL verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "ama",
            display_name: "American Medical Association",
            description: "AMPAC - American Medical Association Political Action Committee.",
            category: "industry_pac",
            confidence: "verified",
            source_citation: "OpenFEC committee search for AMERICAN MEDICAL ASSOCIATION verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "sierra-club",
            display_name: "Sierra Club",
            description: "Sierra Club Political Committee and affiliated environmental advocacy spending.",
            category: "advocacy_network",
            confidence: "verified",
            source_citation: "OpenFEC committee search for SIERRA CLUB verified 2026-07-03",
            source_run_id: Some(run_id),
        },
        InfluenceNetworkUpsert {
            network_slug: "nrlc",
            display_name: "National Right to Life",
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

        // Only update depiction_url, website_url, contact fields — don't overwrite
        // higher-confidence identifiers from unitedstates
        let exists: Option<(String,)> =
            sqlx::query_as("SELECT 1 FROM members WHERE bioguide_id = $1")
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
                depiction_url: Some(member.url.as_deref().unwrap_or("")),
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
                "UPDATE members SET depiction_url = COALESCE($1, depiction_url), source_run_id = $2 WHERE bioguide_id = $3",
            )
            .bind(member.url.as_deref())
            .bind(run_id)
            .bind(&member.bioguide_id)
            .execute(repo.pool())
            .await?;
            written += 1;
        }
    }

    Ok((seen, written))
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
    let query = openfec_api::query::CandidateQuery::default()
        .with_cycle(cycle)
        .with_limit(limit);
    let resp = client.get_candidates(&query).await?;

    let mut seen = 0i64;
    let mut written = 0i64;

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

async fn cmd_lobbying_filings(repo: &Repository, year: u32, page_size: u32, limit_pages: u32) {
    let lda_key = std::env::var("SENATE_LDA_API_KEY").ok();
    let run_id = repo
        .create_source_run(
            SOURCE_LDA,
            &format!("/filings?filing_year={}", year),
            serde_json::json!({ "year": year, "page_size": page_size, "limit_pages": limit_pages }),
        )
        .await
        .expect("Failed to create source_run");

    let result = try_lobbying_filings(repo, run_id, lda_key, year, page_size, limit_pages).await;
    finish_api_run(repo, run_id, result).await;
}

async fn try_lobbying_filings(
    repo: &Repository,
    run_id: uuid::Uuid,
    lda_key: Option<String>,
    year: u32,
    page_size: u32,
    limit_pages: u32,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    let client = match lda_key {
        Some(k) => lobbying_client::LobbyingClient::with_key(k),
        None => lobbying_client::LobbyingClient::new(),
    };

    let mut seen = 0i64;
    let mut written = 0i64;

    for page in 1..=limit_pages {
        let mut query = lobbying_client::types::FilingQuery::default()
            .with_year(year)
            .with_page_size(page_size);
        query.page = Some(page);

        let resp = client.get_filings(&query).await?;
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
                        raw_json: serde_json::to_value(reg)?,
                        source_run_id: Some(run_id),
                    })
                    .await?;
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
                        serde_json::to_value(cl)?,
                        Some(run_id),
                    )
                    .await?;
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
                raw_json: serde_json::to_value(filing)?,
                source_run_id: Some(run_id),
            })
            .await?;
            written += 1;

            // Activities
            if let Some(activities) = &filing.lobbying_activities {
                for activity in activities {
                    let gov_entities = filing
                        .government_entities
                        .as_ref()
                        .map(|ge| serde_json::to_value(ge).unwrap_or_default())
                        .unwrap_or(serde_json::Value::Array(vec![]));

                    repo.upsert_lobbying_activity(
                        &filing_uuid,
                        activity.general_issue_code.as_deref(),
                        activity.general_issue_code.as_deref(), // display name may differ
                        activity.description.as_deref(),
                        gov_entities,
                        Some(run_id),
                    )
                    .await?;
                    written += 1;
                }
            }
        }

        if resp.next.is_none() {
            break;
        }
    }

    Ok((seen, written))
}

// ── Capitol Trades ────────────────────────────────────────────────────────

async fn cmd_capitol_trades(repo: &Repository, limit: u32) {
    let run_id = repo
        .create_source_run(
            SOURCE_CAPITOLTRADES,
            "/trades",
            serde_json::json!({ "limit": limit }),
        )
        .await
        .expect("Failed to create source_run");

    let result = try_capitol_trades(repo, run_id, limit).await;
    finish_api_run(repo, run_id, result).await;
}

async fn try_capitol_trades(
    repo: &Repository,
    run_id: uuid::Uuid,
    limit: u32,
) -> Result<(i64, i64), Box<dyn std::error::Error>> {
    use tracing::warn;

    let client = capitoltrades_api::Client::new();
    client.prime_cookies().await?;

    let mut seen = 0i64;
    let mut written = 0i64;

    let mut current_page = 1i64;
    let mut total_pages = 1i64;

    while current_page <= total_pages {
        let trade_query = capitoltrades_api::TradeQuery::default()
            .with_page(current_page)
            .with_page_size(100);
        let trade_resp = client.get_trades(&trade_query).await?;

        total_pages = trade_resp.meta.paging.total_pages;
        info!(
            "CapitolTrades page {}/{} ({} items total)",
            current_page, total_pages, trade_resp.meta.paging.total_items
        );

        for trade in &trade_resp.data {
            seen += 1;

            let trade_id = format!("ct-{}", trade.tx_id);

            // Resolve bioguide_id by matching politician name against the members table.
            let bioguide_id = repo
                .find_bioguide_by_name(&trade.politician.first_name, &trade.politician.last_name)
                .await?;
            if bioguide_id.is_none() {
                warn!(
                    "No bioguide_id match for {} {} (CapitolTrades politician_id={})",
                    trade.politician.first_name, trade.politician.last_name, trade.politician_id
                );
            }

            let ticker = trade
                .asset
                .as_ref()
                .and_then(|a| a.asset_ticker.as_deref())
                .or(trade.issuer.issuer_ticker.as_deref());

            let asset_name = Some(trade.issuer.issuer_name.as_str());

            let amount_min = trade.size_range_low.map(|v| v as f64);
            let amount_max = trade.size_range_high.map(|v| v as f64);
            let tx_type_str = serde_json::to_string(&trade.tx_type)
                .unwrap_or_else(|_| "unknown".to_string())
                .trim_matches('"')
                .to_lowercase();

            repo.upsert_stock_trade(
                &trade_id,
                bioguide_id.as_deref(),
                Some(&trade.politician_id),
                ticker,
                asset_name,
                &tx_type_str,
                amount_min,
                amount_max,
                None,
                Some(trade.tx_date),
                trade.filing_date,
                trade.filing_url.as_deref(),
                SOURCE_CAPITOLTRADES,
                serde_json::to_value(trade)?,
                Some(run_id),
            )
            .await?;
            written += 1;

            if limit > 0 && seen >= limit as i64 {
                break;
            }
        }

        if limit > 0 && seen >= limit as i64 {
            break;
        }
        current_page += 1;
    }

    Ok((seen, written))
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
    let client = reqwest::Client::new();
    let mut seen = 0i64;
    let mut written = 0i64;

    // 1. Members CSV — load ICPSR crosswalk
    if ingest_members {
        let url = "https://voteview.com/static/data/out/members/HSall_members.csv";
        let csv_text = client.get(url).send().await?.text().await?;
        let mut reader = csv::Reader::from_reader(csv_text.as_bytes());

        for result in reader.records() {
            let record = result?;
            seen += 1;

            let icpsr: &str = record.get(0).unwrap_or("");
            let chamber_code: &str = record.get(4).unwrap_or("");
            let state_code: &str = record.get(5).unwrap_or("");
            let district_code: &str = record.get(6).unwrap_or("");
            let party_code: &str = record.get(9).unwrap_or("");
            let nominate_dim1: Option<f64> = record.get(17).and_then(|v| v.parse().ok());
            let nominate_dim2: Option<f64> = record.get(18).and_then(|v| v.parse().ok());
            let bioname: &str = record.get(7).unwrap_or("");

            if icpsr.is_empty() {
                continue;
            }

            // Try to find by ICPSR
            let bioguide_id = repo
                .find_member_by_identifier(schema::SCHEME_ICPSR, icpsr)
                .await?;

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
        let url = "https://voteview.com/static/data/out/rollcalls/HSall_rollcalls.csv";
        let csv_text = client.get(url).send().await?.text().await?;
        let mut reader = csv::Reader::from_reader(csv_text.as_bytes());

        for result in reader.records() {
            let record = result?;
            seen += 1;

            let congress: i32 = record.get(0).and_then(|v| v.parse().ok()).unwrap_or(0);
            let chamber_code: &str = record.get(1).unwrap_or("");
            let roll_number: i32 = record.get(2).and_then(|v| v.parse().ok()).unwrap_or(0);
            let vote_date: Option<NaiveDate> = record
                .get(4)
                .and_then(|v| NaiveDate::parse_from_str(v, "%Y-%m-%d").ok());
            let question: &str = record.get(5).unwrap_or("");
            let description: &str = record.get(6).unwrap_or("");
            let result_text: &str = record.get(9).unwrap_or("");

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
        let url = "https://voteview.com/static/data/out/votes/HSall_votes.csv";
        let csv_text = client.get(url).send().await?.text().await?;
        let mut reader = csv::Reader::from_reader(csv_text.as_bytes());

        for result in reader.records() {
            let record = result?;
            seen += 1;

            let congress: i32 = record.get(0).and_then(|v| v.parse().ok()).unwrap_or(0);
            let chamber_code: &str = record.get(1).unwrap_or("");
            let roll_number: i32 = record.get(2).and_then(|v| v.parse().ok()).unwrap_or(0);
            let icpsr: &str = record.get(3).unwrap_or("");
            let position: i32 = record.get(4).and_then(|v| v.parse().ok()).unwrap_or(0);

            let chamber = normalize_chamber(chamber_code);

            let vote_id = schema::build_vote_id(congress, &chamber, roll_number);

            let raw_cast = match position {
                1 => "Yea",
                2 => "Nay",
                3 => "Not Voting",
                4 => "Present",
                5 => "Not Present",
                _ => "Unknown",
            };
            let cast_vote = normalize_vote_position(raw_cast);

            let bioguide_id = repo
                .find_member_by_identifier(schema::SCHEME_ICPSR, icpsr)
                .await?;

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
            let status = if fec_key == "DEMO_KEY" {
                "rate_limited"
            } else {
                "failed"
            };
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

// ── Helpers ───────────────────────────────────────────────────────────────

/// Resolve the OpenFEC API key, defaulting to DEMO_KEY if not set.
fn resolve_fec_api_key() -> String {
    std::env::var("OPENFEC_API_KEY").unwrap_or_else(|_| "DEMO_KEY".to_string())
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
            std::process::exit(1);
        }
    }
}
