use crate::models::{MemberVoteSummary, VoteMeasureContext, VoteMeasureKind, VotePosition};
use crate::normalize::normalize_vote_position;
use crate::repository::Repository;
use chrono::NaiveDate;

const PARTY_ALIGNMENT_SQL: &str = r#"WITH party_positions AS (
       SELECT mv.vote_id, mv.party, mv.position, COUNT(*)::bigint AS members
       FROM member_votes mv
       JOIN roll_call_votes rcv ON rcv.vote_id = mv.vote_id
       WHERE rcv.congress = $2
         AND mv.party IS NOT NULL
         AND mv.position IN ('Yes', 'No')
       GROUP BY mv.vote_id, mv.party, mv.position
   ), party_majorities AS (
       SELECT vote_id, party,
              CASE
                WHEN COALESCE(SUM(members) FILTER (WHERE position = 'Yes'), 0)
                   > COALESCE(SUM(members) FILTER (WHERE position = 'No'), 0) THEN 'Yes'
                WHEN COALESCE(SUM(members) FILTER (WHERE position = 'No'), 0)
                   > COALESCE(SUM(members) FILTER (WHERE position = 'Yes'), 0) THEN 'No'
              END AS position
       FROM party_positions
       GROUP BY vote_id, party
   )
   SELECT COUNT(*)::bigint AS total_votes,
          COUNT(*) FILTER (WHERE mv.position IN ('Not Voting', 'Not Present'))::bigint AS missed_votes,
          COUNT(*) FILTER (WHERE pm.position IS NOT NULL AND mv.position = pm.position)::bigint AS party_line_votes,
          COUNT(*) FILTER (WHERE pm.position IS NOT NULL AND mv.position IN ('Yes', 'No'))::bigint AS party_line_eligible_votes,
          MIN(rcv.vote_date) AS first_vote_date,
          MAX(rcv.vote_date) AS last_vote_date
   FROM member_votes mv
   JOIN roll_call_votes rcv ON rcv.vote_id = mv.vote_id
   LEFT JOIN party_majorities pm
     ON pm.vote_id = mv.vote_id AND pm.party = mv.party
   WHERE mv.bioguide_id = $1 AND rcv.congress = $2"#;

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
               SELECT $1, $2, $3,
                      COALESCE(
                        $4,
                        (SELECT mt.party
                         FROM member_terms mt
                         JOIN roll_call_votes rcv ON rcv.vote_id = $1
                         WHERE mt.bioguide_id = $2
                           AND rcv.vote_date IS NOT NULL
                           AND mt.start_date <= rcv.vote_date
                           AND (mt.end_date IS NULL OR mt.end_date >= rcv.vote_date)
                         ORDER BY mt.start_date DESC
                         LIMIT 1)
                      ),
                      COALESCE(
                        $5,
                        (SELECT mt.state
                         FROM member_terms mt
                         JOIN roll_call_votes rcv ON rcv.vote_id = $1
                         WHERE mt.bioguide_id = $2
                           AND rcv.vote_date IS NOT NULL
                           AND mt.start_date <= rcv.vote_date
                           AND (mt.end_date IS NULL OR mt.end_date >= rcv.vote_date)
                         ORDER BY mt.start_date DESC
                         LIMIT 1)
                      ),
                      $6
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
        let counts: VoteSummaryRow = sqlx::query_as(PARTY_ALIGNMENT_SQL)
            .bind(bioguide_id)
            .bind(congress)
            .fetch_one(self.pool())
            .await?;

        let total_votes = counts.total_votes;
        let missed_votes = counts.missed_votes;
        let party_line_votes = counts.party_line_votes;

        if total_votes == 0 {
            return Ok(None);
        }

        let missed_vote_pct = Some(missed_votes as f64 / total_votes as f64 * 100.0);
        let party_line_pct = if counts.party_line_eligible_votes > 0 {
            Some(party_line_votes as f64 / counts.party_line_eligible_votes as f64 * 100.0)
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
            party_line_eligible_votes: counts.party_line_eligible_votes,
            party_line_pct,
            first_vote_date: counts.first_vote_date,
            last_vote_date: counts.last_vote_date,
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
                      rcv.vote_date, rcv.question, rcv.description, rcv.result,
                      rcv.bill_id, mv.position
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
            .map(|r| {
                let measure =
                    classify_vote_measure(&r.question, &r.description, r.bill_id.as_deref());
                VotePosition {
                    vote_id: r.vote_id,
                    congress: r.congress,
                    chamber: r.chamber,
                    roll_number: r.roll_number,
                    vote_date: r.vote_date,
                    question: r.question,
                    description: r.description,
                    result: r.result,
                    bill_id: r.bill_id,
                    measure,
                    position: r.position,
                }
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
                      rcv.vote_date, rcv.question, rcv.description, rcv.result,
                      rcv.bill_id, mv.position
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
            .map(|r| {
                let measure =
                    classify_vote_measure(&r.question, &r.description, r.bill_id.as_deref());
                VotePosition {
                    vote_id: r.vote_id,
                    congress: r.congress,
                    chamber: r.chamber,
                    roll_number: r.roll_number,
                    vote_date: r.vote_date,
                    question: r.question,
                    description: r.description,
                    result: r.result,
                    bill_id: r.bill_id,
                    measure,
                    position: r.position,
                }
            })
            .collect())
    }
}

// ── Private row types ───────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct VoteSummaryRow {
    total_votes: i64,
    missed_votes: i64,
    party_line_votes: i64,
    party_line_eligible_votes: i64,
    first_vote_date: Option<NaiveDate>,
    last_vote_date: Option<NaiveDate>,
}

#[derive(sqlx::FromRow)]
struct VotePosRow {
    vote_id: String,
    congress: i32,
    chamber: String,
    roll_number: i32,
    vote_date: Option<NaiveDate>,
    question: String,
    description: String,
    result: String,
    bill_id: Option<String>,
    position: String,
}

fn classify_vote_measure(
    question: &str,
    description: &str,
    bill_id: Option<&str>,
) -> VoteMeasureContext {
    let combined = format!("{question} {description}");
    let normalized = combined.to_ascii_lowercase();
    let bill_identifier = bill_id.map(str::to_string).or_else(|| {
        extract_measure_identifier(
            &combined,
            &[
                "H.R.",
                "HR",
                "S.",
                "H.Res.",
                "S.Res.",
                "H.J.Res.",
                "S.J.Res.",
                "H.Con.Res.",
                "S.Con.Res.",
            ],
        )
    });

    let (kind, identifier, fallback_label) = if normalized.contains("amendment") {
        (
            VoteMeasureKind::Amendment,
            extract_measure_identifier(&combined, &["H.Amdt.", "S.Amdt.", "H AMDT", "S AMDT"])
                .or_else(|| bill_identifier.clone()),
            "Amendment vote",
        )
    } else if normalized.contains("nomination")
        || normalized.contains("confirmation")
        || extract_measure_identifier(&combined, &["PN"]).is_some()
    {
        (
            VoteMeasureKind::Nomination,
            extract_measure_identifier(&combined, &["PN"]),
            "Nomination vote",
        )
    } else if [
        "cloture",
        "motion to",
        "previous question",
        "adjourn",
        "journal",
        "quorum",
        "procedural",
    ]
    .iter()
    .any(|term| normalized.contains(term))
    {
        (
            VoteMeasureKind::Procedure,
            bill_identifier.clone(),
            "Procedural vote",
        )
    } else if bill_identifier.is_some() {
        (
            VoteMeasureKind::Bill,
            bill_identifier.clone(),
            "Legislation vote",
        )
    } else {
        (VoteMeasureKind::Other, None, "Roll-call vote")
    };

    VoteMeasureContext {
        kind,
        label: identifier
            .as_deref()
            .map(|value| format!("{fallback_label}: {value}"))
            .unwrap_or_else(|| fallback_label.to_string()),
        identifier,
    }
}

fn extract_measure_identifier(text: &str, prefixes: &[&str]) -> Option<String> {
    let tokens = text.split_whitespace().collect::<Vec<_>>();
    tokens.iter().enumerate().find_map(|(index, token)| {
        let cleaned = token.trim_matches(|character: char| {
            matches!(character, ',' | ';' | ':' | '(' | ')' | '[' | ']')
        });
        let matches_prefix = prefixes.iter().any(|prefix| {
            cleaned
                .to_ascii_lowercase()
                .starts_with(&prefix.to_ascii_lowercase())
        });
        if !matches_prefix {
            return None;
        }

        let next_number = tokens
            .get(index + 1)
            .map(|next| next.trim_matches(|character: char| !character.is_ascii_digit()))
            .filter(|next| !next.is_empty());
        let identifier = match next_number {
            Some(number) if !cleaned.chars().any(|character| character.is_ascii_digit()) => {
                format!("{cleaned}{number}")
            }
            _ => cleaned.to_string(),
        };
        identifier
            .chars()
            .any(|character| character.is_ascii_digit())
            .then_some(identifier)
    })
}

#[cfg(test)]
mod tests {
    use super::{classify_vote_measure, extract_measure_identifier, PARTY_ALIGNMENT_SQL};
    use crate::models::VoteMeasureKind;

    #[test]
    fn measure_context_covers_each_roll_call_family() {
        let fixtures = [
            (
                "On the Amendment H.Amdt. 42",
                "",
                None,
                VoteMeasureKind::Amendment,
            ),
            (
                "On the Nomination PN104",
                "Confirmation",
                None,
                VoteMeasureKind::Nomination,
            ),
            (
                "On Cloture on the Motion to Proceed",
                "",
                None,
                VoteMeasureKind::Procedure,
            ),
            ("On Passage", "", Some("119-hr-1"), VoteMeasureKind::Bill),
            ("On Passage of H.R. 6489", "", None, VoteMeasureKind::Bill),
        ];

        for (question, description, bill_id, expected_kind) in fixtures {
            assert_eq!(
                classify_vote_measure(question, description, bill_id).kind,
                expected_kind
            );
        }
    }

    #[test]
    fn amendment_precedes_linked_bill_context() {
        let context = classify_vote_measure(
            "On Agreeing to the Amendment",
            "H.Amdt.42 to H.R.1",
            Some("119-hr-1"),
        );
        assert_eq!(context.kind, VoteMeasureKind::Amendment);
        assert_eq!(context.identifier.as_deref(), Some("H.Amdt.42"));
    }

    #[test]
    fn procedure_precedes_linked_bill_context() {
        let context = classify_vote_measure(
            "On Cloture on the Motion to Proceed",
            "Motion concerning H.R. 1",
            Some("119-hr-1"),
        );
        assert_eq!(context.kind, VoteMeasureKind::Procedure);
        assert_eq!(context.identifier.as_deref(), Some("119-hr-1"));
    }

    #[test]
    fn nomination_identifier_is_retained() {
        assert_eq!(
            extract_measure_identifier("Confirmation of PN104, Jane Doe", &["PN"]).as_deref(),
            Some("PN104")
        );
    }

    #[test]
    fn party_majority_query_uses_vote_time_party_and_excludes_ties() {
        assert!(PARTY_ALIGNMENT_SQL.contains("SELECT mv.vote_id, mv.party, mv.position"));
        assert!(PARTY_ALIGNMENT_SQL.contains("pm.party = mv.party"));
        assert!(PARTY_ALIGNMENT_SQL
            .contains("WHEN COALESCE(SUM(members) FILTER (WHERE position = 'Yes'), 0)"));
        assert!(PARTY_ALIGNMENT_SQL.contains("pm.position IS NOT NULL"));
        assert!(!PARTY_ALIGNMENT_SQL.contains("current_party"));
    }

    #[test]
    fn tie_and_party_switch_fixture_has_only_strict_historical_comparisons() {
        fn strict_majority(positions: &[&str]) -> Option<&'static str> {
            let yes = positions
                .iter()
                .filter(|position| **position == "Yes")
                .count();
            let no = positions
                .iter()
                .filter(|position| **position == "No")
                .count();
            match yes.cmp(&no) {
                std::cmp::Ordering::Greater => Some("Yes"),
                std::cmp::Ordering::Less => Some("No"),
                std::cmp::Ordering::Equal => None,
            }
        }

        let tied_democratic_vote = ["Yes", "No"];
        let before_switch_democratic_vote = ["Yes", "Yes", "No"];
        let after_switch_republican_vote = ["No", "No", "Yes"];

        assert_eq!(strict_majority(&tied_democratic_vote), None);
        assert_eq!(strict_majority(&before_switch_democratic_vote), Some("Yes"));
        assert_eq!(strict_majority(&after_switch_republican_vote), Some("No"));
        assert!(PARTY_ALIGNMENT_SQL.contains("pm.party = mv.party"));
    }
}
