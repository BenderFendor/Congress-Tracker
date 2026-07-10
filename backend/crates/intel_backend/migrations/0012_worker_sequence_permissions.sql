-- Worker inserts rely on identity sequences created by the core schema.
-- Table grants alone do not confer nextval() permission in PostgreSQL.
DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['intel_worker', 'congress_tracker'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA %I TO %I',
        current_schema(),
        role_name
      );
    END IF;
  END LOOP;
END $$;
