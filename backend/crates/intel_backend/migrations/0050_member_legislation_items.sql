-- Preserve every Member-linked bill, amendment, or other legislation item by official URL.

CREATE TABLE member_legislation_items (
    bioguide_id TEXT NOT NULL REFERENCES members(bioguide_id),
    role TEXT NOT NULL CHECK (role IN ('sponsor', 'cosponsor')),
    source_url TEXT NOT NULL,
    congress INTEGER NOT NULL CHECK (congress > 0),
    item_kind TEXT NOT NULL CHECK (item_kind IN ('bill', 'amendment', 'other')),
    item_type TEXT,
    item_number INTEGER,
    title TEXT,
    introduced_date DATE,
    latest_action_date DATE,
    latest_action_text TEXT,
    raw_item JSONB NOT NULL,
    source_run_id UUID NOT NULL REFERENCES source_runs(id),
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bioguide_id, role, source_url),
    CHECK (item_number IS NULL OR item_number > 0)
);

CREATE INDEX idx_member_legislation_items_member
    ON member_legislation_items (bioguide_id, congress, role, latest_action_date DESC);
CREATE INDEX idx_member_legislation_items_run
    ON member_legislation_items (source_run_id);
