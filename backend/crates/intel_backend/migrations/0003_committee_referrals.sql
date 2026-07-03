-- Add committee_referrals column to bills for linking bills to committees
ALTER TABLE bills ADD COLUMN IF NOT EXISTS committee_referrals TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_bills_committee_referrals ON bills USING gin(committee_referrals);
