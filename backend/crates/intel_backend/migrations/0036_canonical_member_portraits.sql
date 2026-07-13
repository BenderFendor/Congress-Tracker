-- Congress.gov member list `url` values point to JSON metadata, not images.
-- Store the deterministic official Bioguide portrait location for canonical
-- member identifiers so every client receives the same image contract.

UPDATE members
SET depiction_url = 'https://bioguide.congress.gov/bioguide/photo/'
    || upper(left(bioguide_id, 1)) || '/' || bioguide_id || '.jpg'
WHERE bioguide_id ~ '^[A-Za-z][0-9]{6}$'
  AND (
    depiction_url IS NULL
    OR btrim(depiction_url) = ''
    OR depiction_url LIKE 'https://api.congress.gov/%'
  );
