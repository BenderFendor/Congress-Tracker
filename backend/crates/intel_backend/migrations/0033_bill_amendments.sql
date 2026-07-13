-- Migration 0033: bill amendments table for tracking
-- congressional bill amendments with actions and status.
CREATE TABLE IF NOT EXISTS bill_amendments (
  id BIGSERIAL PRIMARY KEY,
  bill_id TEXT REFERENCES bills(bill_id),
  congress INTEGER NOT NULL,
  bill_type TEXT NOT NULL,
  bill_number INTEGER NOT NULL,
  amendment_number TEXT,
  description TEXT,
  amendment_type TEXT,
  sponsor_name TEXT,
  sponsor_bioguide_id TEXT,
  introduced_date DATE,
  latest_action_date DATE,
  latest_action_text TEXT,
  chamber TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  source_run_id UUID REFERENCES source_runs(id),
  UNIQUE(bill_id, amendment_number)
);

CREATE INDEX IF NOT EXISTS idx_bill_amendments_bill ON bill_amendments(bill_id);
