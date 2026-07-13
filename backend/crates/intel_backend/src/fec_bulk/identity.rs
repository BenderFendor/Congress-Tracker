//! Deterministic FEC candidate, member, and principal-committee resolution.

use sqlx::PgPool;

pub async fn resolve_candidate_members(
    pool: &PgPool,
    source_run_id: uuid::Uuid,
) -> Result<i64, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let updated = sqlx::query(
        r#"WITH possible AS (
               SELECT candidate.candidate_id, member.bioguide_id
               FROM fec_candidates candidate
               JOIN members member
                 ON member.in_office = true
                AND member.current_state = candidate.state
                AND ((candidate.office = 'H' AND member.current_chamber = 'House')
                     OR (candidate.office = 'S' AND member.current_chamber = 'Senate'))
                AND regexp_replace(
                      lower(split_part(candidate.name, ',', 1)), '[^a-z0-9]', '', 'g'
                    ) = regexp_replace(lower(member.last_name), '[^a-z0-9]', '', 'g')
                AND regexp_replace(
                      lower(split_part(trim(split_part(candidate.name, ',', 2)), ' ', 1)),
                      '[^a-z0-9]', '', 'g'
                    ) = regexp_replace(
                      lower(split_part(member.first_name, ' ', 1)), '[^a-z0-9]', '', 'g'
                    )
                AND (candidate.office <> 'H' OR COALESCE(
                      NULLIF(ltrim(candidate.district, '0'), ''), '0'
                    ) = COALESCE(NULLIF(ltrim(member.current_district, '0'), ''), '0'))
           ), unique_matches AS (
               SELECT candidate_id, MIN(bioguide_id) AS bioguide_id
               FROM possible
               GROUP BY candidate_id
               HAVING COUNT(DISTINCT bioguide_id) = 1
           )
           UPDATE fec_candidates candidate
               SET bioguide_id = matched.bioguide_id,
               source_run_id = $1
           FROM unique_matches matched
           WHERE candidate.candidate_id = matched.candidate_id
             AND candidate.bioguide_id IS DISTINCT FROM matched.bioguide_id"#,
    )
    .bind(source_run_id)
    .execute(&mut *transaction)
    .await?
    .rows_affected() as i64;

    sqlx::query(
        r#"INSERT INTO member_identifiers (bioguide_id, scheme, value, source_run_id)
           SELECT bioguide_id, 'fec', candidate_id, $1
           FROM fec_candidates
           WHERE bioguide_id IS NOT NULL
           ON CONFLICT (bioguide_id, scheme, value)
           DO UPDATE SET source_run_id = EXCLUDED.source_run_id"#,
    )
    .bind(source_run_id)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(updated)
}

pub async fn add_principal_committee_links(
    pool: &PgPool,
    election_cycle: i32,
    source_run_id: uuid::Uuid,
) -> Result<i64, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    sqlx::query(
        r#"INSERT INTO fec_linkage_issues
           (election_cycle, candidate_id, committee_id, issue_type, source_run_id)
           SELECT $1, candidate.candidate_id, candidate.principal_committee_id,
                  'principal_committee_missing', $2
           FROM fec_candidates candidate
           LEFT JOIN fec_committees committee
             ON committee.committee_id = candidate.principal_committee_id
           WHERE (candidate.active_through >= $1 OR candidate.bioguide_id IS NOT NULL)
             AND candidate.office IN ('H', 'S')
             AND candidate.principal_committee_id IS NOT NULL
             AND committee.committee_id IS NULL
           ON CONFLICT (election_cycle, candidate_id, committee_id, issue_type)
           DO UPDATE SET source_run_id = EXCLUDED.source_run_id,
                         last_seen_at = now(),
                         resolved = false,
                         resolved_at = NULL"#,
    )
    .bind(election_cycle)
    .bind(source_run_id)
    .execute(&mut *transaction)
    .await?;

    let linked = sqlx::query(
        r#"INSERT INTO fec_candidate_committees
           (candidate_id, committee_id, election_cycle,
            committee_type, committee_designation, linkage_id)
           SELECT candidate.candidate_id, candidate.principal_committee_id, $1,
                  committee.committee_type, 'P', NULL
           FROM fec_candidates candidate
           JOIN fec_committees committee
             ON committee.committee_id = candidate.principal_committee_id
           WHERE (candidate.active_through >= $1 OR candidate.bioguide_id IS NOT NULL)
             AND candidate.office IN ('H', 'S')
             AND candidate.principal_committee_id IS NOT NULL
           ON CONFLICT (candidate_id, committee_id, election_cycle)
           DO UPDATE SET committee_type = COALESCE(
                           EXCLUDED.committee_type,
                           fec_candidate_committees.committee_type
                         ),
                         committee_designation = COALESCE(
                           fec_candidate_committees.committee_designation,
                           EXCLUDED.committee_designation
                         )"#,
    )
    .bind(election_cycle)
    .execute(&mut *transaction)
    .await?
    .rows_affected() as i64;

    sqlx::query(
        r#"UPDATE fec_linkage_issues issue
           SET resolved = true, resolved_at = now(), last_seen_at = now()
           WHERE issue.election_cycle = $1
             AND issue.issue_type = 'principal_committee_missing'
             AND EXISTS (
                 SELECT 1 FROM fec_committees committee
                 WHERE committee.committee_id = issue.committee_id
             )"#,
    )
    .bind(election_cycle)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(linked)
}
