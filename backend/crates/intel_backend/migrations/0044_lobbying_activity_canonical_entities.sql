-- Canonicalize semantic LDA identity without modifying applied migration 0043.

DROP INDEX IF EXISTS idx_lobbying_activities_semantic_unique;

UPDATE lobbying_activities activity
SET government_entities = (
  SELECT COALESCE(
    jsonb_agg(entity ORDER BY entity->>'id', entity->>'name', entity::text),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(activity.government_entities) entity
)
WHERE jsonb_typeof(activity.government_entities) = 'array';

DELETE FROM lobbying_activities duplicate
USING lobbying_activities canonical
WHERE duplicate.id > canonical.id
  AND COALESCE(duplicate.filing_uuid, '') = COALESCE(canonical.filing_uuid, '')
  AND COALESCE(duplicate.issue_code, '') = COALESCE(canonical.issue_code, '')
  AND COALESCE(duplicate.issue_display, '') = COALESCE(canonical.issue_display, '')
  AND COALESCE(duplicate.description, '') = COALESCE(canonical.description, '')
  AND duplicate.government_entities = canonical.government_entities;

CREATE UNIQUE INDEX idx_lobbying_activities_semantic_unique
  ON lobbying_activities (
    md5(
      length(COALESCE(filing_uuid, ''))::text || ':' || COALESCE(filing_uuid, '') ||
      length(COALESCE(issue_code, ''))::text || ':' || COALESCE(issue_code, '') ||
      length(COALESCE(issue_display, ''))::text || ':' || COALESCE(issue_display, '') ||
      length(COALESCE(description, ''))::text || ':' || COALESCE(description, '') ||
      length(government_entities::text)::text || ':' || government_entities::text
    )
  );
