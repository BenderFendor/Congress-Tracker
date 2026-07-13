-- Collapse legacy LDA activity duplicates and enforce semantic rerun identity.

DELETE FROM lobbying_activities duplicate
USING lobbying_activities canonical
WHERE duplicate.id > canonical.id
  AND duplicate.filing_uuid IS NOT DISTINCT FROM canonical.filing_uuid
  AND duplicate.issue_code IS NOT DISTINCT FROM canonical.issue_code
  AND duplicate.issue_display IS NOT DISTINCT FROM canonical.issue_display
  AND duplicate.description IS NOT DISTINCT FROM canonical.description
  AND duplicate.government_entities = canonical.government_entities;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lobbying_activities_semantic_unique
  ON lobbying_activities (
    md5(
      COALESCE(length(filing_uuid)::text || ':' || filing_uuid, '-1:') ||
      COALESCE(length(issue_code)::text || ':' || issue_code, '-1:') ||
      COALESCE(length(issue_display)::text || ':' || issue_display, '-1:') ||
      COALESCE(length(description)::text || ':' || description, '-1:') ||
      length(government_entities::text)::text || ':' || government_entities::text
    )
  );
