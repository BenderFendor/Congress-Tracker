ALTER TABLE disclosure_assets
    ADD COLUMN IF NOT EXISTS financial_asset_id BIGINT REFERENCES financial_assets(id);

CREATE INDEX IF NOT EXISTS idx_disclosure_assets_financial_asset
    ON disclosure_assets(financial_asset_id);
