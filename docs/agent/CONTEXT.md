# CongressTracker

Domain language for the congressional accountability tracker. Defines what things are called, not how they are implemented.

## Members and identity

**Member**:
A current or former Member of the U.S. House of Representatives or Senate.
_Avoid_: legislator, lawmaker, congressperson, politician

**Bioguide ID**:
The canonical member key. An alphanumeric identifier assigned by the Biographical Directory of the U.S. Congress (e.g. `A000370`).
_Avoid_: member_id, person_id, internal_id

**Filer**:
A person who submitted a financial disclosure report — may be a Member, candidate, officer, or senior staff.
_Avoid_: submitter, author, discloser

**Member-eligible filing**:
A supported filing whose official filer identity and reporting context establish that it may legitimately attach to a Member. Candidate, staff, and officer filings are not forced into this category.
_Avoid_: unresolved filing, member filing

**Candidate**:
A person registered in an election cycle for federal office through official election or FEC records. A Candidate links to a Member only through verified identity evidence.
_Avoid_: Member, politician

**Profile fact**:
One independently sourced biographical or official-contact assertion about a Member, carrying its own source, date context, evidence tier, and conflict state.
_Avoid_: profile metadata, biography field

## Disclosure documents

**PTR** (Periodic Transaction Report):
A report filed within 45 days of a securities transaction over $1,000, required by the STOCK Act. Contains individual trade rows with asset name, ticker, transaction type, date, and amount range.
_Avoid_: trade report, stock filing, transaction filing

**Annual Report**:
A comprehensive yearly financial disclosure listing assets, liabilities, income, gifts, positions, and agreements. Filed by Members, candidates, and senior staff.
_Avoid_: yearly filing, annual filing, FD

**Filing type code**:
A single-letter code from the House Clerk index: `P` (PTR), `A` (Annual), `O` (other annual), `N` (New member), `T` (Termination).
_Avoid_: report_type, form_code, document_type

**Document version**:
A content-addressed snapshot of a disclosure document. Two versions of the same filing (e.g. original and amended) share a `disclosure_documents` row but have distinct `document_versions` rows keyed by SHA-256 hash.

## Evidence model

**Direct evidence**:
A claim with an explicit, verifiable source record. Example: a specific FEC committee ID appearing in a specific filing.
_Avoid_: hard evidence, primary evidence

**Derived evidence**:
A claim computed from direct evidence through a defined, repeatable method. Example: net worth range calculated from asset and liability bounds.
_Avoid_: computed evidence, secondary evidence

**Contextual evidence**:
A claim based on heuristics or external knowledge, not a source record. Example: keyword similarity between a bill title and a lobbying filing.
_Avoid_: soft evidence, inferred evidence

**Evidence tier badge**:
A visible label on a data point indicating its evidence tier: `Record` (direct), `Computed` (derived), or `Pattern` (contextual). Each badge links to the underlying source records.
_Avoid_: confidence indicator, reliability score

**Money-votes correlation**:
A contextual-evidence pattern showing alignment between a member's campaign contributions from an industry and their voting record on bills affecting that industry. Always labeled with a `Pattern` badge and a section-level disclaimer that it does not prove causation.
_Avoid_: influence score, vote buying, corruption index

**Coverage state**:
A declared status for a data source or query result: `loaded`, `partial`, `missing`, `missing_consent`, `failed`, `stale`. A missing source is never presented as a factual zero.

**Source run**:
A record in the `source_runs` table tracking one ingestion operation: source name, endpoint, parameters, status (`success`/`partial`/`failed`/`auth_missing`/`rate_limited`), rows seen, rows written, error details, and timestamps. The freshness ledger.

## Campaign finance

**Direct receipt**:
A contribution from an individual to a campaign committee (FEC Schedule A, line 11(a)). Excludes memos, refunds, transfers, and outside spending.
_Avoid_: donation, contribution (too broad)

**Independent expenditure**:
Spending by a PAC or other entity that is not coordinated with a candidate's campaign (FEC Schedule E).
_Avoid_: outside spending, super PAC spending

**Operating disbursement**:
A campaign committee's payment for goods or services (FEC Schedule B).
_Avoid_: expenditure, campaign spending

**Committee transfer**:
Movement of funds between authorized committees of the same candidate. Not a receipt from a donor.
_Avoid_: inter-committee transfer, transfer receipt

**Canonical record**:
The version of a FEC transaction after amendment precedence has been applied. Latest valid amendment supersedes earlier versions.
_Avoid_: golden record, master record

## Financial disclosure values

**Amount range**:
A bounded dollar range as reported on a disclosure form (e.g. $1,001–$15,000). The minimum is always known; the maximum may be unbounded (`NULL` for categories like "Over $50,000,000").
_Avoid_: value, estimated value, amount

**Conservative net worth**:
The range from (sum of asset minimums minus sum of liability maximums) to (sum of asset maximums minus sum of liability minimums). Excludes the personal residence unless explicitly reported.

**Unbounded maximum**:
A `NULL` upper bound on a disclosure value range, meaning the source did not specify a ceiling. Must not be replaced with an invented number.

## Ingestion

**Ingest job**:
A row in the `ingest_jobs` table representing one unit of work: `download_document`, `parse_document`, or other job types. Uses `FOR UPDATE SKIP LOCKED` for concurrent workers.

**Worker**:
The `intel_worker` binary that runs discovery, download, parse, identity resolution, profile evidence refresh, FEC bulk refresh, Senate eFD refresh, and SEC crosswalk on configurable intervals.

**Backfill**:
A worker run with `--backfill` that processes all eligible historical data (all years, all members) rather than just recent/current windows.

**Senate eFD terms acceptance**:
Explicit operator authorization to access the terms-gated Senate electronic Financial Disclosure source. Authorization permits acquisition but is not itself proof that Senate records were discovered or loaded.
_Avoid_: Senate access enabled, Senate data loaded

**Terminal state**:
A source run or ingest job that has reached a final outcome — success, partial with accounted-for gaps, or failed with a documented reason. Not "still running."
_Avoid_: done, finished, complete (too ambiguous)

**Supported-filing outcome**:
The terminal result for an indexed filing whose type the warehouse claims to process. Acquisition failures, parser failures, partial normalization, and successful normalization all count toward this outcome.
_Avoid_: parser result, download result

**Acquisition failure**:
A supported filing that cannot reach the parser because its official source document could not be retrieved, including a terminal official HTTP 404.
_Avoid_: parser failure

**Archived recovery**:
A disclosure document recovered from a preservation service after its official URL became unavailable, with an intact retrieval chain and identity validated against official index metadata.
_Avoid_: mirror, cached copy, official document

**Parser failure**:
A retrieved supported filing that the parser cannot classify or normalize without inventing evidence.
_Avoid_: download failure, unsupported filing

**Parser candidate**:
A non-canonical structured interpretation emitted by one deterministic extraction strategy, retaining its source coordinates and validation results.
_Avoid_: parsed row, probable result

**Validated agreement**:
Field-level agreement between independent parser candidates after both satisfy the filing schema and source-coordinate invariants. It may be promoted to canonical evidence.
_Avoid_: high confidence, consensus score

**Gold filing**:
A public disclosure filing with agent-verified, field-level expected records and source coordinates used to measure parser accuracy and prevent regressions.
_Avoid_: fixture, sample PDF

**Gold adjudication**:
Source-page review that resolves a field-level disagreement between two independent gold-filing verification passes.
_Avoid_: majority vote, confidence review

**Layout family**:
A deterministic group of disclosure documents sharing structural signatures such as headings, page geometry, coordinate bands, rules, and text-layer behavior.
_Avoid_: template guess, similar PDF

**Document correction**:
An auditable, document-hash-bound field correction for a genuinely unique filing that cannot yet be handled by a generalized layout family.
_Avoid_: parser exception, filing-ID hack

## Influence and lobbying

**Influence network**:
A named group of related FEC committees, lobbying registrants, and lobbying clients. Has a `network_type`: `organization` (e.g. AIPAC, NRA, PhRMA) or `industry` (e.g. Pharma, Defense, Tech). Organization networks carry lobbying data; industry networks aggregate across all committees tagged with that sector.
_Avoid_: interest group, advocacy network

**Industry network**:
An influence network of type `industry`, representing an economic sector rather than a specific organization. Aggregates campaign finance data across member committees but carries no lobbying data.
_Avoid_: sector, vertical, market segment

**Organization network**:
An influence network of type `organization`, representing a specific entity with FEC committee IDs and optionally LDA registrants/clients.
_Avoid_: advocacy group, interest group

**Alias**:
A search-time alternate name for an influence network (e.g. "United Democracy Project" → AIPAC). Does not rewrite the stored canonical name or FEC committee ID.

**LDA filing**:
A lobbying disclosure report filed under the Lobbying Disclosure Act, containing registrant, client, lobbyist, issues, government entities contacted, and reported income or expenses.
_Avoid_: lobbying report, lobbying record

## Elections

**County result**:
A certified federal general-election result reported for a county or county-equivalent, retaining office, district, vote totals, share, margin, stage, and source status.
_Avoid_: county activity, county estimate, county projection

**Upcoming-election state**:
Candidate filings, deadlines, and ballot information shown before certified results exist. It is not a result or forecast.
_Avoid_: live result, race rating

## System

**Public evidence view**:
A plain-language, source-backed presentation for non-expert users that can progressively reveal research detail without hiding coverage limits.
_Avoid_: dashboard, simplified view

**Review workspace**:
A private local agent workflow for parser candidates, source coordinates, validation failures, identity ambiguity, and gold adjudication. It is not part of the hosted public application.
_Avoid_: admin page, debug page, public review UI

**Public data plane**:
The read-only hosted website and API that serve bounded, prepared evidence without starting ingestion, parsing, review, or mutation work.
_Avoid_: public backend, admin API

**Dossier**:
The primary public evidence view for one Member, candidate, committee, organization, bill, or influence network, joining distinct evidence channels without collapsing their legal or methodological boundaries.
_Avoid_: profile, detail page, dashboard

**intel_backend**:
The canonical Postgres-backed Axum API server. Owns routes, models, repositories, ingest CLI, and migrations.
_Avoid_: backend_server (legacy compatibility crate)

**intel_worker**:
The background worker binary that runs scheduled ingestion and recovery loops. Owns the parse pipeline, job queue processing, and source freshness.

**backend_server**:
Legacy compatibility crate. New page contracts do not belong here. Retained until a call-site audit proves safe removal.
