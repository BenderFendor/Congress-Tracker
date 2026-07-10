use crate::models::{MemberVoteSummary, VotePosition};
use crate::normalize::normalize_vote_position;
use crate::repository::Repository;
use chrono::NaiveDate;

pub struct RollCallVoteUpsert<'a> {
    pub vote_id: &'a str,
    pub congress: i32,
    pub chamber: &'a str,
    pub session: Option<i32>,
    pub roll_number: i32,
    pub vote_date: Option<NaiveDate>,
    pub question: &'a str,
    pub description: &'a str,
    pub result: &'a str,
    pub bill_id: Option<&'a str>,
    pub source_url: Option<&'a str>,
    pub source_run_id: Option<uuid::Uuid>,
}

impl Repository {
    /// Insert or update a roll-call vote row.
    pub async fn upsert_roll_call_vote(
        &self,
        input: RollCallVoteUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO roll_call_votes
               (vote_id, congress, chamber, session, roll_number, vote_date,
                question, description, result, bill_id, source_url, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
               ON CONFLICT (vote_id) DO UPDATE SET
                 congress    = EXCLUDED.congress,
                 chamber     = EXCLUDED.chamber,
                 session     = COALESCE(EXCLUDED.session, roll_call_votes.session),
                 roll_number = EXCLUDED.roll_number,
                 vote_date   = COALESCE(EXCLUDED.vote_date, roll_call_votes.vote_date),
                 question    = EXCLUDED.question,
                 description = EXCLUDED.description,
                 result      = EXCLUDED.result,
                 bill_id     = COALESCE(EXCLUDED.bill_id, roll_call_votes.bill_id),
                 source_url  = COALESCE(EXCLUDED.source_url, roll_call_votes.source_url)"#,
        )
        .bind(input.vote_id)
        .bind(input.congress)
        .bind(input.chamber)
        .bind(input.session)
        .bind(input.roll_number)
        .bind(input.vote_date)
        .bind(input.question)
        .bind(input.description)
        .bind(input.result)
        .bind(input.bill_id)
        .bind(input.source_url)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Insert or update a member's position on a roll-call vote.
    pub async fn upsert_member_vote(
        &self,
        vote_id: &str,
        bioguide_id: &str,
        position: &str,
        party: Option<&str>,
        state: Option<&str>,
        source_run_id: Option<uuid::Uuid>,
    ) -> Result<(), sqlx::Error> {
        let norm_position = normalize_vote_position(position);
        sqlx::query(
            r#"INSERT INTO member_votes
               (vote_id, bioguide_id, position, party, state, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (vote_id, bioguide_id)
               DO UPDATE SET
                 position = EXCLUDED.position,
                 party    = COALESCE(EXCLUDED.party, member_votes.party),
                 state    = COALESCE(EXCLUDED.state, member_votes.state)"#,
        )
        .bind(vote_id)
        .bind(bioguide_id)
        .bind(&*norm_position)
        .bind(party)
        .bind(state)
        .bind(source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Get vote summary for a member within a congress, reading from the
    /// materialized view and computing missed-vote / party-line percentages.
    pub async fn get_member_vote_summary(
        &self,
        bioguide_id: &str,
        congress: i32,
    ) -> Result<Option<MemberVoteSummary>, sqlx::Error> {
        // Try materialized view first
        let mv_row: Option<MvSummaryRow> = sqlx::query_as::<_, MvSummaryRow>(
            r#"SELECT total_votes, missed_votes, party_line_votes
               FROM member_vote_summary_mv
               WHERE bioguide_id = $1 AND congress = $2"#,
        )
        .bind(bioguide_id)
        .bind(congress)
        .fetch_optional(self.pool())
        .await?;

        let (total_votes, missed_votes, party_line_votes) = if let Some(mv) = &mv_row {
            (mv.total_votes, mv.missed_votes, mv.party_line_votes)
        } else {
            // Compute directly from member_votes and roll_call_votes
            let counts: Option<(i64, i64, i64)> = sqlx::query_as(
                r#"SELECT
                    COUNT(*)::bigint,
                    COUNT(*) FILTER (WHERE mv.position IN ('Not Voting', 'Not Present'))::bigint,
                    COUNT(*) FILTER (WHERE mv.position = mv.party)::bigint
                 FROM member_votes mv
                 JOIN roll_call_votes rcv ON rcv.vote_id = mv.vote_id
                 WHERE mv.bioguide_id = $1 AND rcv.congress = $2"#,
            )
            .bind(bioguide_id)
            .bind(congress)
            .fetch_optional(self.pool())
            .await?;

            match counts {
                Some(c) => c,
                None => return Ok(None),
            }
        };

        if total_votes == 0 {
            return Ok(None);
        }

        let missed_vote_pct = Some(missed_votes as f64 / total_votes as f64 * 100.0);
        let party_line_pct = if total_votes > 0 {
            Some(party_line_votes as f64 / total_votes as f64 * 100.0)
        } else {
            None
        };

        // Load recent votes
        let recent_votes = self
            .get_member_votes_for_congress(bioguide_id, congress, 20, 0)
            .await?;

        Ok(Some(MemberVoteSummary {
            bioguide_id: bioguide_id.to_string(),
            congress,
            total_votes,
            missed_votes,
            missed_vote_pct,
            party_line_votes,
            party_line_pct,
            recent_votes,
        }))
    }

    /// Get the most recent vote positions for a member.
    pub async fn get_member_recent_votes(
        &self,
        bioguide_id: &str,
        limit: i64,
    ) -> Result<Vec<VotePosition>, sqlx::Error> {
        self.get_member_votes_for_congress(bioguide_id, 0, limit, 0)
            .await
    }

    /// Get paginated vote positions for a member, optionally constrained to a
    /// Congress. A congress of zero means all available Congresses.
    pub async fn get_member_votes_for_congress(
        &self,
        bioguide_id: &str,
        congress: i32,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<VotePosition>, sqlx::Error> {
        let rows: Vec<VotePosRow> = sqlx::query_as::<_, VotePosRow>(
            r#"SELECT rcv.vote_id, rcv.congress, rcv.chamber, rcv.roll_number,
                      rcv.vote_date, rcv.question, mv.position
               FROM member_votes mv
               JOIN roll_call_votes rcv ON rcv.vote_id = mv.vote_id
               WHERE mv.bioguide_id = $1
                 AND ($2 = 0 OR rcv.congress = $2)
               ORDER BY rcv.vote_date DESC NULLS LAST, rcv.roll_number DESC
               LIMIT $3 OFFSET $4"#,
        )
        .bind(bioguide_id)
        .bind(congress)
        .bind(limit)
        .bind(offset)
        .fetch_all(self.pool())
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| VotePosition {
                vote_id: r.vote_id,
                congress: r.congress,
                chamber: r.chamber,
                roll_number: r.roll_number,
                vote_date: r.vote_date,
                question: r.question,
                position: r.position,
            })
            .collect())
    }

    /// Get all member vote positions for a specific roll-call vote.
    pub async fn get_vote_positions(
        &self,
        vote_id: &str,
    ) -> Result<Vec<VotePosition>, sqlx::Error> {
        let rows: Vec<VotePosRow> = sqlx::query_as::<_, VotePosRow>(
            r#"SELECT rcv.vote_id, rcv.congress, rcv.chamber, rcv.roll_number,
                      rcv.vote_date, rcv.question, mv.position
               FROM member_votes mv
               JOIN roll_call_votes rcv ON rcv.vote_id = mv.vote_id
               WHERE mv.vote_id = $1
               ORDER BY mv.position, rcv.roll_number"#,
        )
        .bind(vote_id)
        .fetch_all(self.pool())
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| VotePosition {
                vote_id: r.vote_id,
                congress: r.congress,
                chamber: r.chamber,
                roll_number: r.roll_number,
                vote_date: r.vote_date,
                question: r.question,
                position: r.position,
            })
            .collect())
    }
}

// ── Private row types ───────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct MvSummaryRow {
    total_votes: i64,
    missed_votes: i64,
    party_line_votes: i64,
}

#[derive(sqlx::FromRow)]
struct VotePosRow {
    vote_id: String,
    congress: i32,
    chamber: String,
    roll_number: i32,
    vote_date: Option<NaiveDate>,
    question: String,
    position: String,
}
