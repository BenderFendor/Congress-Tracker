-- Migration 0005: register deterministic relationship derivation runs.

INSERT INTO data_sources
  (source, display_name, source_type, license, base_url, default_ttl_seconds, confidence, notes)
VALUES
  ('relationship_derivation', 'CongressTracker relationship derivation', 'derived_database_view', 'Project output', 'N/A', 86400, 'high', 'Deterministic edges derived from normalized source records; never a substitute for source evidence')
ON CONFLICT (source) DO NOTHING;
