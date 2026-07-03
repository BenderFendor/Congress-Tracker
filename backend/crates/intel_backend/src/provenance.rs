/// Provenance utilities for building source-confidence metadata
/// on API responses.
///
/// Every data point served by the intel backend should carry provenance
/// information so consumers can assess reliability.
use crate::models::{ProvenanceSource, ProvenanceSummary};

/// Build a `ProvenanceSummary` from a slice of `(source, status, confidence)` tuples.
///
/// Each tuple corresponds to a single data source that contributed to the
/// response. `fetched_at` is set to `None` — callers should populate it
/// from source metadata when available.
///
/// # Example
///
/// ```
/// # use intel_backend::build_provenance;
/// let summary = build_provenance(&[
///     ("unitedstates_legislators", "loaded", Some("verified")),
///     ("openfec", "not_seeded", None),
/// ]);
/// assert_eq!(summary.sources.len(), 2);
/// ```
pub fn build_provenance(sources: &[(&str, &str, Option<&str>)]) -> ProvenanceSummary {
    let sources: Vec<ProvenanceSource> = sources
        .iter()
        .map(|(source, status, confidence)| ProvenanceSource {
            source: source.to_string(),
            status: status.to_string(),
            fetched_at: None,
            confidence: confidence.map(|s| s.to_string()),
        })
        .collect();

    ProvenanceSummary {
        sources,
        warnings: Vec::new(),
    }
}

/// Append a warning label to a provenance summary.
///
/// Warnings are used to flag data-quality issues visible to the frontend,
/// such as "next_election_unavailable_missing_terms" or "no_fec_data_for_cycle".
pub fn add_warning(summary: &mut ProvenanceSummary, warning: &str) {
    summary.warnings.push(warning.to_string());
}

/// Map a raw confidence string to a user-facing confidence label.
///
/// Rules:
/// - `"verified"` → `"Official"`
/// - `"high"` → `"Academic"`
/// - `"medium"` → `"Community"`
/// - `"low"` or `"heuristic"` → `"Heuristic"`
/// - Any other value (including `None`) → `"Unavailable"`
pub fn source_confidence_label(confidence: Option<&str>) -> &'static str {
    match confidence {
        Some("verified") => "Official",
        Some("high") => "Academic",
        Some("medium") => "Community",
        Some("low") | Some("heuristic") => "Heuristic",
        _ => "Unavailable",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_provenance_empty() {
        let summary = build_provenance(&[]);
        assert!(summary.sources.is_empty());
        assert!(summary.warnings.is_empty());
    }

    #[test]
    fn test_build_provenance_with_sources() {
        let summary = build_provenance(&[
            ("unitedstates_legislators", "loaded", Some("verified")),
            ("openfec", "not_seeded", None),
        ]);
        assert_eq!(summary.sources.len(), 2);
        assert_eq!(summary.sources[0].source, "unitedstates_legislators");
        assert_eq!(summary.sources[0].confidence.as_deref(), Some("verified"));
        assert_eq!(summary.sources[1].source, "openfec");
        assert!(summary.sources[1].confidence.is_none());
    }

    #[test]
    fn test_add_warning() {
        let mut summary = build_provenance(&[("source", "loaded", Some("verified"))]);
        add_warning(&mut summary, "test_warning");
        assert_eq!(summary.warnings.len(), 1);
        assert_eq!(summary.warnings[0], "test_warning");
    }

    #[test]
    fn test_confidence_label_verified() {
        assert_eq!(source_confidence_label(Some("verified")), "Official");
    }

    #[test]
    fn test_confidence_label_high() {
        assert_eq!(source_confidence_label(Some("high")), "Academic");
    }

    #[test]
    fn test_confidence_label_medium() {
        assert_eq!(source_confidence_label(Some("medium")), "Community");
    }

    #[test]
    fn test_confidence_label_low() {
        assert_eq!(source_confidence_label(Some("low")), "Heuristic");
    }

    #[test]
    fn test_confidence_label_heuristic() {
        assert_eq!(source_confidence_label(Some("heuristic")), "Heuristic");
    }

    #[test]
    fn test_confidence_label_none() {
        assert_eq!(source_confidence_label(None), "Unavailable");
    }

    #[test]
    fn test_confidence_label_unknown() {
        assert_eq!(source_confidence_label(Some("unknown")), "Unavailable");
    }
}
