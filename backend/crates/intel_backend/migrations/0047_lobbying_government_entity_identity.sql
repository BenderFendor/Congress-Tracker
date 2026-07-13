-- Canonicalize government entities by stable ID, with normalized name fallback.

DROP INDEX IF EXISTS idx_lobbying_activities_semantic_unique;

UPDATE lobbying_activities activity
SET government_entities = (
  SELECT COALESCE(
    jsonb_agg(identity ORDER BY identity::text),
    '[]'::jsonb
  )
  FROM (
    SELECT DISTINCT CASE
      WHEN entity ? 'id' AND entity->'id' <> 'null'::jsonb
        THEN jsonb_build_object('id', entity->'id')
      ELSE jsonb_build_object(
        'name', lower(btrim(COALESCE(entity->>'name', '')))
      )
    END AS identity
    FROM jsonb_array_elements(activity.government_entities) entity
  ) normalized
)
WHERE jsonb_typeof(activity.government_entities) = 'array';

DELETE FROM lobbying_activities duplicate
USING lobbying_activities canonical
WHERE duplicate.id > canonical.id
  AND COALESCE(duplicate.filing_uuid, '') = COALESCE(canonical.filing_uuid, '')
  AND COALESCE(duplicate.issue_code, '') = COALESCE(canonical.issue_code, '')
  AND COALESCE(duplicate.issue_display, '') = COALESCE(canonical.issue_display, '')
  AND COALESCE(duplicate.description, '') = COALESCE(canonical.description, '')
  AND COALESCE(duplicate.foreign_entity_issues, '') =
      COALESCE(canonical.foreign_entity_issues, '')
  AND duplicate.government_entities = canonical.government_entities
  AND duplicate.lobbyist_identity = canonical.lobbyist_identity;

CREATE UNIQUE INDEX idx_lobbying_activities_semantic_unique
  ON lobbying_activities (
    md5(
      length(COALESCE(filing_uuid, ''))::text || ':' || COALESCE(filing_uuid, '') ||
      length(COALESCE(issue_code, ''))::text || ':' || COALESCE(issue_code, '') ||
      length(COALESCE(issue_display, ''))::text || ':' || COALESCE(issue_display, '') ||
      length(COALESCE(description, ''))::text || ':' || COALESCE(description, '') ||
      length(COALESCE(foreign_entity_issues, ''))::text || ':' ||
        COALESCE(foreign_entity_issues, '') ||
      length(government_entities::text)::text || ':' || government_entities::text ||
      length(lobbyist_identity::text)::text || ':' || lobbyist_identity::text
    )
  );
