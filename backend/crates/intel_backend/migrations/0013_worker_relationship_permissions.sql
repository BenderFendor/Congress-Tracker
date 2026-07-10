-- Identity resolution writes evidence edges after parsing a disclosure.
DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['intel_worker', 'congress_tracker'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE ON TABLE %I.relationship_evidence TO %I',
        current_schema(),
        role_name
      );
    END IF;
  END LOOP;
END $$;
