-- Preserve migration 0036's applied checksum while normalizing the uncommon
-- lowercase Bioguide identifiers accepted by its input predicate.

UPDATE members
SET depiction_url = 'https://bioguide.congress.gov/bioguide/photo/'
    || upper(left(bioguide_id, 1)) || '/' || upper(bioguide_id) || '.jpg'
WHERE bioguide_id ~ '^[A-Za-z][0-9]{6}$'
  AND bioguide_id <> upper(bioguide_id)
  AND depiction_url = 'https://bioguide.congress.gov/bioguide/photo/'
    || upper(left(bioguide_id, 1)) || '/' || bioguide_id || '.jpg';
