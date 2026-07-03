// Standalone entity resolution logic with confidence scoring.
//
// These functions are deterministic and stateless — they score evidence
// bundles against known crosswalk rules. Database-backed resolution
// methods live in `repository::entity_resolution`.

/// Evidence bundle for a single entity being resolved.
pub struct EntityEvidence {
    /// Direct Bioguide ID, if provided by the source.
    pub bioguide_id: Option<String>,
    /// FEC candidate_id for crosswalk.
    pub fec_id: Option<String>,
    /// Voteview ICPSR ID for crosswalk.
    pub icpsr_id: Option<String>,
    /// Full human-readable name (e.g. "Nancy Pelosi").
    pub full_name: String,
    /// Two-letter state code, if known.
    pub state: Option<String>,
    /// Chamber ("house", "senate", or empty), if known.
    pub chamber: Option<String>,
}

/// Result of an entity resolution attempt.
pub struct ResolutionResult {
    /// Resolved Bioguide ID, or `None` if unresolvable.
    pub bioguide_id: Option<String>,
    /// Confidence score between 0.0 and 1.0.
    pub confidence: f64,
    /// Human-readable reason for the match or failure.
    pub reason: String,
    /// `true` when confidence >= 0.85 and the result can be auto-attached
    /// without human review.
    pub should_auto_attach: bool,
}

impl ResolutionResult {
    /// Build a result for an exact bioguide_id match (confidence = 1.0).
    pub fn exact_match(id: &str) -> Self {
        Self {
            bioguide_id: Some(id.to_string()),
            confidence: 1.0,
            reason: format!("exact bioguide_id match: {}", id),
            should_auto_attach: true,
        }
    }

    /// Build a result for a scheme-based match (confidence = 1.0).
    pub fn scheme_match(id: &str, scheme: &str) -> Self {
        Self {
            bioguide_id: Some(id.to_string()),
            confidence: 1.0,
            reason: format!("{} identifier match: {}", scheme, id),
            should_auto_attach: true,
        }
    }

    /// Build a result for a name+state+chamber fuzzy match.
    pub fn name_match(id: &str, score: f64) -> Self {
        let label = if score >= 0.85 {
            "exact name + state + chamber"
        } else if score >= 0.65 {
            "exact name + state (no chamber)"
        } else {
            "partial name match"
        };
        Self {
            bioguide_id: Some(id.to_string()),
            confidence: score,
            reason: format!("{} match: {} (score={})", label, id, score),
            should_auto_attach: score >= 0.85,
        }
    }

    /// Build a result for an unresolved entity.
    pub fn unresolved(reason: &str) -> Self {
        Self {
            bioguide_id: None,
            confidence: 0.0,
            reason: reason.to_string(),
            should_auto_attach: false,
        }
    }
}

/// Resolve a Bioguide ID from an evidence bundle using the deterministic
/// crosswalk order:
///
/// 1. Exact bioguide_id evidence (1.0)
/// 2. FEC candidate_id via member_identifiers (1.0 when provided)
/// 3. ICPSR via member_identifiers (1.0 when provided)
/// 4. Exact normalized name + state + chamber (0.85)
/// 5. Exact normalized name + state only (0.65)
/// 6. Unresolved (0.0)
///
/// The `repo_bioguide_by_scheme` and `repo_bioguide_by_name` arguments
/// are pre-resolved database results — this function only scores them.
pub fn resolve_bioguide(
    evidence: &EntityEvidence,
    repo_bioguide_by_scheme: Option<&str>,
    repo_bioguide_by_name: Option<(&str, f64)>,
) -> ResolutionResult {
    // Priority 1: exact bioguide_id
    if let Some(ref bid) = evidence.bioguide_id {
        return ResolutionResult::exact_match(bid);
    }

    // Priority 2: FEC scheme match (via database lookup already performed)
    if let Some(bid) = repo_bioguide_by_scheme {
        return ResolutionResult::scheme_match(
            bid,
            if evidence.fec_id.is_some() {
                "fec"
            } else if evidence.icpsr_id.is_some() {
                "icpsr"
            } else {
                "scheme"
            },
        );
    }

    // Priority 3: name-based match
    if let Some((bid, score)) = repo_bioguide_by_name {
        return ResolutionResult::name_match(bid, score);
    }

    // Fallback: unresolvable
    let mut reasons: Vec<String> = Vec::new();
    reasons.push("no bioguide_id in evidence".to_string());
    if evidence.fec_id.is_some() {
        reasons.push("fec lookup returned no match".to_string());
    }
    if evidence.icpsr_id.is_some() {
        reasons.push("icpsr lookup returned no match".to_string());
    }
    if evidence.state.is_some() {
        reasons.push("name+state lookup returned no match".to_string());
    }

    ResolutionResult::unresolved(&reasons.join("; "))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_match() {
        let evidence = EntityEvidence {
            bioguide_id: Some("A000360".to_string()),
            fec_id: None,
            icpsr_id: None,
            full_name: "Test".to_string(),
            state: None,
            chamber: None,
        };
        let result = resolve_bioguide(&evidence, None, None);
        assert_eq!(result.bioguide_id.unwrap(), "A000360");
        assert!((result.confidence - 1.0).abs() < f64::EPSILON);
        assert!(result.should_auto_attach);
    }

    #[test]
    fn test_scheme_match() {
        let evidence = EntityEvidence {
            bioguide_id: None,
            fec_id: Some("H0CA12345".to_string()),
            icpsr_id: None,
            full_name: "Test".to_string(),
            state: None,
            chamber: None,
        };
        let result = resolve_bioguide(&evidence, Some("A000360"), None);
        assert_eq!(result.bioguide_id.unwrap(), "A000360");
        assert!((result.confidence - 1.0).abs() < f64::EPSILON);
        assert!(result.should_auto_attach);
    }

    #[test]
    fn test_name_state_chamber_match() {
        let evidence = EntityEvidence {
            bioguide_id: None,
            fec_id: None,
            icpsr_id: None,
            full_name: "Nancy Pelosi".to_string(),
            state: Some("CA".to_string()),
            chamber: Some("house".to_string()),
        };
        let result = resolve_bioguide(&evidence, None, Some(("P000197", 0.85)));
        assert_eq!(result.bioguide_id.unwrap(), "P000197");
        assert!((result.confidence - 0.85).abs() < f64::EPSILON);
        assert!(result.should_auto_attach);
    }

    #[test]
    fn test_name_state_only_match() {
        let evidence = EntityEvidence {
            bioguide_id: None,
            fec_id: None,
            icpsr_id: None,
            full_name: "Nancy Pelosi".to_string(),
            state: Some("CA".to_string()),
            chamber: None,
        };
        let result = resolve_bioguide(&evidence, None, Some(("P000197", 0.65)));
        assert_eq!(result.bioguide_id.unwrap(), "P000197");
        assert!((result.confidence - 0.65).abs() < f64::EPSILON);
        assert!(!result.should_auto_attach);
    }

    #[test]
    fn test_unresolved() {
        let evidence = EntityEvidence {
            bioguide_id: None,
            fec_id: None,
            icpsr_id: None,
            full_name: "Unknown Person".to_string(),
            state: None,
            chamber: None,
        };
        let result = resolve_bioguide(&evidence, None, None);
        assert!(result.bioguide_id.is_none());
        assert!((result.confidence - 0.0).abs() < f64::EPSILON);
        assert!(!result.should_auto_attach);
    }
}
