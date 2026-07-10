-- Migration 0016: FEC bulk ZIP ingestion pipeline
--
-- Adds tables for downloading FEC bulk data ZIPs, staging raw pipe-delimited
-- records, storing canonical (amendment-resolved) transactions, and precomputed
-- donor/committee rankings.
--
-- The staging tables hold raw rows from indivYY.zip and othYY.zip during
-- import and are dropped after canonicalization. Canonical tables and rankings
-- persist for API queries.

-- ============================================================
-- 1. Bulk import tracking (idempotent replay)
-- ============================================================

CREATE TABLE IF NOT EXISTS fec_bulk_imports (
    dataset_name      TEXT NOT NULL,           -- 'indiv26', 'oth26', 'cm26', 'ccl26'
    election_cycle    INTEGER NOT NULL,
    downloaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_url        TEXT NOT NULL,
    sha256            TEXT NOT NULL,
    compressed_bytes  BIGINT,
    extracted_rows    BIGINT,
    status            TEXT NOT NULL DEFAULT 'downloaded'
        CHECK (status IN ('downloaded', 'parsed', 'canonicalized', 'failed')),
    error_message     TEXT,
    PRIMARY KEY (dataset_name, sha256)
);

-- ============================================================
-- 2. Staging: raw pipe-delimited from indivYY.zip
-- ============================================================

CREATE TABLE IF NOT EXISTS fec_staging_individuals (
    sub_id              BIGINT NOT NULL,
    committee_id        TEXT NOT NULL,
    amendment_ind       TEXT,
    report_type         TEXT,
    transaction_pgi     TEXT,
    image_num           TEXT,
    transaction_type    TEXT,
    entity_type         TEXT,
    contributor_name    TEXT,
    contributor_city    TEXT,
    contributor_state   TEXT,
    contributor_zip     TEXT,
    contributor_employer TEXT,
    contributor_occupation TEXT,
    transaction_date    DATE,
    transaction_amount  NUMERIC NOT NULL,
    other_id            TEXT,
    tran_id             TEXT,
    filing_num          BIGINT,
    memo_code           TEXT,
    memo_text           TEXT,
    file_year           INTEGER,
    import_batch        UUID NOT NULL,
    PRIMARY KEY (sub_id, import_batch)
);

CREATE INDEX IF NOT EXISTS idx_fec_staging_individuals_batch
    ON fec_staging_individuals(import_batch);

-- ============================================================
-- 3. Staging: raw pipe-delimited from othYY.zip
-- ============================================================

CREATE TABLE IF NOT EXISTS fec_staging_committee_txns (
    sub_id              BIGINT NOT NULL,
    committee_id        TEXT NOT NULL,
    amendment_ind       TEXT,
    report_type         TEXT,
    transaction_pgi     TEXT,
    image_num           TEXT,
    transaction_type    TEXT,
    entity_type         TEXT,
    contributor_name    TEXT,
    contributor_city    TEXT,
    contributor_state   TEXT,
    contributor_zip     TEXT,
    contributor_employer TEXT,
    contributor_occupation TEXT,
    transaction_date    DATE,
    transaction_amount  NUMERIC NOT NULL,
    other_id            TEXT,
    tran_id             TEXT,
    filing_num          BIGINT,
    memo_code           TEXT,
    memo_text           TEXT,
    file_year           INTEGER,
    import_batch        UUID NOT NULL,
    PRIMARY KEY (sub_id, import_batch)
);

CREATE INDEX IF NOT EXISTS idx_fec_staging_committee_txns_batch
    ON fec_staging_committee_txns(import_batch);

-- ============================================================
-- 4. Candidate-committee links (from cclYY.zip)
-- ============================================================

CREATE TABLE IF NOT EXISTS fec_candidate_committees (
    candidate_id    TEXT NOT NULL REFERENCES fec_candidates(candidate_id),
    committee_id    TEXT NOT NULL REFERENCES fec_committees(committee_id),
    election_cycle  INTEGER NOT NULL,
    committee_type  TEXT,
    committee_designation TEXT,
    linkage_id      BIGINT,
    PRIMARY KEY (candidate_id, committee_id, election_cycle)
);

CREATE INDEX IF NOT EXISTS idx_fec_candidate_committees_candidate
    ON fec_candidate_committees(candidate_id, election_cycle);

-- ============================================================
-- 5. Canonical individual receipts (amendments resolved)
-- ============================================================

CREATE TABLE IF NOT EXISTS fec_canonical_individual_receipts (
    sub_id              BIGINT PRIMARY KEY,
    committee_id        TEXT NOT NULL,
    contributor_name    TEXT NOT NULL,
    contributor_zip     TEXT,
    contributor_employer TEXT,
    transaction_date    DATE,
    amount              NUMERIC NOT NULL,
    donor_key           TEXT NOT NULL,
    election_cycle      INTEGER NOT NULL,
    filing_num          BIGINT,
    is_current          BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_fec_canonical_indiv_cycle
    ON fec_canonical_individual_receipts(election_cycle);
CREATE INDEX IF NOT EXISTS idx_fec_canonical_indiv_committee
    ON fec_canonical_individual_receipts(committee_id, election_cycle);
CREATE INDEX IF NOT EXISTS idx_fec_canonical_indiv_donor
    ON fec_canonical_individual_receipts(donor_key, election_cycle);

-- ============================================================
-- 6. Canonical committee receipts (amendments resolved)
-- ============================================================

CREATE TABLE IF NOT EXISTS fec_canonical_committee_receipts (
    sub_id                  BIGINT PRIMARY KEY,
    recipient_committee_id  TEXT NOT NULL,
    donor_committee_id      TEXT NOT NULL,
    transaction_date        DATE,
    amount                  NUMERIC NOT NULL,
    election_cycle          INTEGER NOT NULL,
    filing_num              BIGINT,
    is_current              BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_fec_canonical_comm_cycle
    ON fec_canonical_committee_receipts(election_cycle);
CREATE INDEX IF NOT EXISTS idx_fec_canonical_comm_recipient
    ON fec_canonical_committee_receipts(recipient_committee_id, election_cycle);

-- ============================================================
-- 7. Precomputed donor rankings
-- ============================================================

CREATE TABLE IF NOT EXISTS fec_candidate_donor_rankings (
    candidate_id        TEXT NOT NULL,
    election_cycle      INTEGER NOT NULL,
    donor_key           TEXT NOT NULL,
    display_name        TEXT NOT NULL,
    total_amount        NUMERIC NOT NULL,
    contribution_count  INTEGER NOT NULL,
    most_recent_date    DATE,
    rank                INTEGER NOT NULL,
    PRIMARY KEY (candidate_id, election_cycle, donor_key)
);

CREATE INDEX IF NOT EXISTS idx_fec_donor_rankings_candidate
    ON fec_candidate_donor_rankings(candidate_id, election_cycle, rank);

-- ============================================================
-- 8. Precomputed committee rankings (split by relationship type)
-- ============================================================

CREATE TABLE IF NOT EXISTS fec_candidate_committee_rankings (
    candidate_id      TEXT NOT NULL,
    election_cycle    INTEGER NOT NULL,
    committee_id      TEXT NOT NULL REFERENCES fec_committees(committee_id),
    committee_name    TEXT NOT NULL,
    total_amount      NUMERIC NOT NULL,
    transaction_count INTEGER NOT NULL,
    ranking_type      TEXT NOT NULL
        CHECK (ranking_type IN ('contribution', 'transfer', 'leadership_pac', 'independent_expenditure')),
    rank              INTEGER NOT NULL,
    PRIMARY KEY (candidate_id, election_cycle, committee_id, ranking_type)
);

CREATE INDEX IF NOT EXISTS idx_fec_comm_rankings_candidate
    ON fec_candidate_committee_rankings(candidate_id, election_cycle, ranking_type, rank);
