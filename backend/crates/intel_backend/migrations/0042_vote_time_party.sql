-- Backfill historical roll-call party/state from the term active on vote day.
-- Existing non-null source values are preserved because Congress/Voteview may
-- know about party changes more precisely than the term dataset.
WITH resolved AS (
  SELECT DISTINCT ON (mv.vote_id, mv.bioguide_id)
         mv.vote_id,
         mv.bioguide_id,
         mt.party,
         mt.state
  FROM member_votes mv
  JOIN roll_call_votes rcv ON rcv.vote_id = mv.vote_id
  JOIN member_terms mt ON mt.bioguide_id = mv.bioguide_id
  WHERE mv.party IS NULL
    AND rcv.vote_date IS NOT NULL
    AND mt.start_date <= rcv.vote_date
    AND (mt.end_date IS NULL OR mt.end_date >= rcv.vote_date)
  ORDER BY mv.vote_id, mv.bioguide_id, mt.start_date DESC
)
UPDATE member_votes mv
SET party = resolved.party,
    state = COALESCE(mv.state, resolved.state)
FROM resolved
WHERE mv.vote_id = resolved.vote_id
  AND mv.bioguide_id = resolved.bioguide_id;
