CREATE TABLE IF NOT EXISTS funding_cache (
    bioguide_id TEXT NOT NULL,
    cycle INT NOT NULL,
    data JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bioguide_id, cycle)
);

CREATE INDEX IF NOT EXISTS idx_funding_cache_fetched
    ON funding_cache (fetched_at);
