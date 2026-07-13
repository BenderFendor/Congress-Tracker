-- Separate official FEC sources for leadership-PAC sponsorship and outside
-- spending. Neither dataset is folded into direct campaign receipts.

CREATE TABLE IF NOT EXISTS fec_leadership_pacs (
    election_cycle             INTEGER NOT NULL,
    committee_id               TEXT NOT NULL,
    committee_name             TEXT NOT NULL,
    filing_url                 TEXT,
    sponsor_name               TEXT,
    sponsor_candidate_id       TEXT,
    sponsor_bioguide_id        TEXT REFERENCES members(bioguide_id),
    sponsor_resolution_status  TEXT NOT NULL
        CHECK (sponsor_resolution_status IN ('resolved', 'ambiguous', 'unresolved')),
    cash_on_hand               NUMERIC,
    coverage_end_date          DATE,
    total_disbursements        NUMERIC,
    total_receipts             NUMERIC,
    raw_row                    JSONB NOT NULL,
    source_run_id              UUID REFERENCES source_runs(id),
    imported_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (election_cycle, committee_id)
);

CREATE INDEX IF NOT EXISTS idx_fec_leadership_pacs_member
    ON fec_leadership_pacs(sponsor_bioguide_id, election_cycle);

CREATE TABLE IF NOT EXISTS fec_independent_expenditures (
    election_cycle       INTEGER NOT NULL,
    source_key           TEXT NOT NULL,
    candidate_id         TEXT NOT NULL,
    candidate_name       TEXT,
    spender_id           TEXT,
    spender_name         TEXT,
    election_type        TEXT,
    candidate_state      TEXT,
    candidate_district   TEXT,
    candidate_office     TEXT,
    candidate_party      TEXT,
    amount               NUMERIC NOT NULL,
    expenditure_date     DATE,
    aggregate_amount     NUMERIC,
    support_oppose       TEXT NOT NULL
        CHECK (support_oppose IN ('S', 'O', 'U')),
    purpose              TEXT,
    payee                TEXT,
    file_number          BIGINT,
    amendment_indicator  TEXT,
    transaction_id       TEXT,
    image_number         TEXT,
    receipt_date         DATE,
    previous_file_number BIGINT,
    dissemination_date   DATE,
    dedupe_method        TEXT NOT NULL
        CHECK (dedupe_method IN ('transaction_id', 'fingerprint')),
    raw_row              JSONB NOT NULL,
    source_run_id        UUID REFERENCES source_runs(id),
    imported_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (election_cycle, source_key)
);

CREATE INDEX IF NOT EXISTS idx_fec_ie_candidate
    ON fec_independent_expenditures(candidate_id, election_cycle, support_oppose);
CREATE INDEX IF NOT EXISTS idx_fec_ie_spender
    ON fec_independent_expenditures(spender_id, election_cycle);
