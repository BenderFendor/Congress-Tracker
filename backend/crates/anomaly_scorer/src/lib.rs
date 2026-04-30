//! Congressional anomaly scoring using a 6-signal weighted model.
//!
//! Based on the Anomaly Score algorithm from
//! [CongressWatch](https://github.com/OpenSourcePatents/Congresswatch) by OpenSourcePatents.
//!
//! The score is a statistical indicator only — not a legal judgment.
//! All inputs are from public records.

use serde::{Deserialize, Serialize};

/// The six individual signal scores that combine to form the anomaly score.
/// Each signal is normalized to 0-100.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalySignals {
    /// Trades within 30 days of related legislation (weight: 25%)
    pub stock_timing: f64,
    /// Net worth vs. cumulative congressional salary (weight: 25%)
    pub wealth_gap: f64,
    /// Voting record alignment with donor interests (weight: 20%)
    pub donor_vote_alignment: f64,
    /// Bills copied from lobbying org templates? (weight: 15%)
    pub bill_authorship: f64,
    /// Trips sponsored by foreign-connected entities (weight: 10%)
    pub foreign_travel: f64,
    /// Missed votes while collecting full salary (weight: 5%)
    pub attendance: f64,
}

impl Default for AnomalySignals {
    fn default() -> Self {
        Self {
            stock_timing: 0.0,
            wealth_gap: 0.0,
            donor_vote_alignment: 0.0,
            bill_authorship: 0.0,
            foreign_travel: 0.0,
            attendance: 0.0,
        }
    }
}

/// Full anomaly score result for a single member.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyScore {
    pub member_identifier: String,
    pub member_name: String,
    pub signals: AnomalySignals,
    pub overall_score: f64,
    pub percentile: Option<f64>,
}

/// Compute the weighted anomaly score from individual signals.
/// Weights from CongressWatch:
/// - Stock trade timing: 25%
/// - Wealth gap: 25%
/// - Donor-vote alignment: 20%
/// - Bill authorship: 15%
/// - Foreign travel: 10%
/// - Attendance: 5%
pub fn compute_anomaly_score(signals: &AnomalySignals) -> f64 {
    0.25 * signals.stock_timing
        + 0.25 * signals.wealth_gap
        + 0.20 * signals.donor_vote_alignment
        + 0.15 * signals.bill_authorship
        + 0.10 * signals.foreign_travel
        + 0.05 * signals.attendance
}

/// Normalize a raw value to a 0-100 score based on its percentile rank
/// within a population.
///
/// Higher is always "more anomalous". Values at the top of the population
/// get scores near 100.
pub fn normalize_to_percentile(value: f64, all_values: &[f64]) -> f64 {
    if all_values.is_empty() {
        return 50.0;
    }
    let mut sorted: Vec<f64> = all_values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    // Count how many values are <= this one
    let rank = sorted.iter().filter(|&&v| v <= value).count();
    let total = sorted.len();

    100.0 * rank as f64 / total as f64
}

/// Compute the overall percentile of an anomaly score within a population.
pub fn compute_percentile(score: f64, all_scores: &[f64]) -> f64 {
    normalize_to_percentile(score, all_scores)
}

/// Compute scores for all members and assign percentiles.
pub fn score_all_members(scores: Vec<AnomalyScore>) -> Vec<AnomalyScore> {
    let overalls: Vec<f64> = scores.iter().map(|s| s.overall_score).collect();
    scores
        .into_iter()
        .map(|mut s| {
            s.percentile = Some(compute_percentile(s.overall_score, &overalls));
            s
        })
        .collect()
}

/// Stock trade timing signal: count trades within 30 days of related legislation.
pub fn compute_stock_timing_signal(trades_near_legislation: usize, total_trades: usize) -> f64 {
    if total_trades == 0 {
        return 0.0;
    }
    (trades_near_legislation as f64 / total_trades as f64) * 100.0
}

/// Wealth gap signal: estimated_net_worth / (174000 * years_in_congress).
/// A ratio of 1.0 means net worth equals cumulative salary.
pub fn compute_wealth_gap_signal(estimated_net_worth: f64, years_in_congress: f64) -> f64 {
    const ANNUAL_SALARY: f64 = 174_000.0;
    let cumulative_salary = ANNUAL_SALARY * years_in_congress;
    if cumulative_salary <= 0.0 {
        return 50.0;
    }
    // Return the ratio (will be normalized via percentile later)
    estimated_net_worth / cumulative_salary
}

/// Donor-vote alignment signal: aggregate correlation between donations and voting.
pub fn compute_donor_alignment_signal(
    donor_amounts: &[(String, f64)],      // (industry, donation_amount)
    industry_alignment: &[(String, f64)], // (industry, vote_alignment_pct)
) -> f64 {
    if donor_amounts.is_empty() || industry_alignment.is_empty() {
        return 0.0;
    }
    let alignment_map: std::collections::HashMap<&str, f64> = industry_alignment
        .iter()
        .map(|(k, v)| (k.as_str(), *v))
        .collect();
    let total: f64 = donor_amounts
        .iter()
        .map(|(industry, amount)| {
            let align = alignment_map.get(industry.as_str()).copied().unwrap_or(0.0);
            amount * align
        })
        .sum();
    let total_donations: f64 = donor_amounts.iter().map(|(_, a)| a).sum();
    if total_donations <= 0.0 {
        0.0
    } else {
        total / total_donations
    }
}

/// Bill authorship signal: average TF-IDF cosine similarity between member's bills
/// and known lobbying organization template texts.
///
/// Higher similarity = more suspicion of ghost-written legislation.
pub fn compute_bill_authorship_signal(
    similarities: &[f64], // cosine similarity scores per bill
) -> f64 {
    if similarities.is_empty() {
        return 0.0;
    }
    let avg: f64 = similarities.iter().sum::<f64>() / similarities.len() as f64;
    avg * 100.0 // Convert to 0-100 scale
}

/// Simple TF cosine similarity between two text strings.
/// Based on CongressWatch's bill similarity engine.
pub fn tfidf_cosine_similarity(text_a: &str, text_b: &str) -> f64 {
    let tokens_a = tokenize(text_a);
    let tokens_b = tokenize(text_b);

    if tokens_a.is_empty() || tokens_b.is_empty() {
        return 0.0;
    }

    let mut tf_a: std::collections::HashMap<&str, f64> = std::collections::HashMap::new();
    let mut tf_b: std::collections::HashMap<&str, f64> = std::collections::HashMap::new();

    for t in &tokens_a {
        *tf_a.entry(t).or_insert(0.0) += 1.0;
    }
    for t in &tokens_b {
        *tf_b.entry(t).or_insert(0.0) += 1.0;
    }

    let total_a = tokens_a.len() as f64;
    let total_b = tokens_b.len() as f64;
    for v in tf_a.values_mut() {
        *v /= total_a;
    }
    for v in tf_b.values_mut() {
        *v /= total_b;
    }

    let dot: f64 = tf_a
        .iter()
        .map(|(k, v)| v * tf_b.get(k).unwrap_or(&0.0))
        .sum();

    let norm_a: f64 = tf_a.values().map(|v| v * v).sum::<f64>().sqrt();
    let norm_b: f64 = tf_b.values().map(|v| v * v).sum::<f64>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot / (norm_a * norm_b)
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| s.len() > 2)
        .map(|s| s.to_string())
        .collect()
}

/// Foreign travel signal: percentage of trips sponsored by foreign-connected entities.
pub fn compute_foreign_travel_signal(foreign_connected_trips: usize, total_trips: usize) -> f64 {
    if total_trips == 0 {
        return 0.0;
    }
    (foreign_connected_trips as f64 / total_trips as f64) * 100.0
}

/// Attendance signal: percentage of votes missed.
pub fn compute_attendance_signal(missed_votes: usize, total_votes: usize) -> f64 {
    if total_votes == 0 {
        return 0.0;
    }
    (missed_votes as f64 / total_votes as f64) * 100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_weighted_score_all_zero() {
        let signals = AnomalySignals::default();
        assert_eq!(compute_anomaly_score(&signals), 0.0);
    }

    #[test]
    fn test_weighted_score_all_fifty() {
        let signals = AnomalySignals {
            stock_timing: 50.0,
            wealth_gap: 50.0,
            donor_vote_alignment: 50.0,
            bill_authorship: 50.0,
            foreign_travel: 50.0,
            attendance: 50.0,
        };
        assert_eq!(compute_anomaly_score(&signals), 50.0);
    }

    #[test]
    fn test_weighted_score_max() {
        let signals = AnomalySignals {
            stock_timing: 100.0,
            wealth_gap: 100.0,
            donor_vote_alignment: 100.0,
            bill_authorship: 100.0,
            foreign_travel: 100.0,
            attendance: 100.0,
        };
        assert_eq!(compute_anomaly_score(&signals), 100.0);
    }

    #[test]
    fn test_normalize_percentile_middle() {
        let all: Vec<f64> = vec![0.0, 25.0, 50.0, 75.0, 100.0];
        let score = normalize_to_percentile(50.0, &all);
        assert!((score - 60.0).abs() < 5.0); // approx middle
    }

    #[test]
    fn test_normalize_percentile_max() {
        let all: Vec<f64> = vec![0.0, 25.0, 50.0, 75.0, 100.0];
        let score = normalize_to_percentile(100.0, &all);
        assert_eq!(score, 100.0);
    }

    #[test]
    fn test_normalize_percentile_min() {
        let all: Vec<f64> = vec![0.0, 25.0, 50.0, 75.0, 100.0];
        let score = normalize_to_percentile(0.0, &all);
        assert!((score - 20.0).abs() < 5.0);
    }

    #[test]
    fn test_stock_timing_signal() {
        let score = compute_stock_timing_signal(3, 10);
        assert_eq!(score, 30.0);
    }

    #[test]
    fn test_stock_timing_no_trades() {
        let score = compute_stock_timing_signal(0, 0);
        assert_eq!(score, 0.0);
    }

    #[test]
    fn test_wealth_gap_typical() {
        // Net worth $1.74M, 10 years → ratio = 1.0
        let signal = compute_wealth_gap_signal(1_740_000.0, 10.0);
        assert!((signal - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_wealth_gap_large() {
        // Net worth $17.4M, 5 years → ratio = 20.0
        let signal = compute_wealth_gap_signal(17_400_000.0, 5.0);
        assert!((signal - 20.0).abs() < 0.02);
    }

    #[test]
    fn test_attendance_perfect() {
        assert_eq!(compute_attendance_signal(0, 100), 0.0);
    }

    #[test]
    fn test_attendance_poor() {
        assert_eq!(compute_attendance_signal(20, 100), 20.0);
    }

    #[test]
    fn test_tfidf_identical() {
        let sim = tfidf_cosine_similarity("tax reform and healthcare", "tax reform and healthcare");
        assert!((sim - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_tfidf_different() {
        let sim = tfidf_cosine_similarity("tax reform healthcare", "space exploration defense");
        assert!(sim < 0.5);
    }

    #[test]
    fn test_foreign_travel_signal() {
        assert_eq!(compute_foreign_travel_signal(2, 10), 20.0);
    }

    #[test]
    fn test_score_all_members() {
        let scores = vec![
            AnomalyScore {
                member_identifier: "A001".to_string(),
                member_name: "Member A".to_string(),
                signals: AnomalySignals {
                    stock_timing: 80.0,
                    ..Default::default()
                },
                overall_score: 80.0,
                percentile: None,
            },
            AnomalyScore {
                member_identifier: "B001".to_string(),
                member_name: "Member B".to_string(),
                signals: AnomalySignals {
                    stock_timing: 20.0,
                    ..Default::default()
                },
                overall_score: 20.0,
                percentile: None,
            },
        ];
        let scored = score_all_members(scores);
        assert_eq!(scored.len(), 2);
        assert!(scored[0].percentile.unwrap() > scored[1].percentile.unwrap());
    }

    // NOTE: The following two signals (donor alignment and bill authorship) require
    // real data from OpenFEC contribution records and Congress.gov bill text for
    // meaningful computation. These tests use synthetic data to verify the signal
    // formulas are correct and are ready for integration when that data pipeline
    // becomes available.

    #[test]
    fn test_donor_alignment_signal_with_synthetic_data() {
        let donor_amounts = vec![
            ("Defense".to_string(), 50_000.0),
            ("Pharma".to_string(), 100_000.0),
            ("Tech".to_string(), 25_000.0),
        ];
        let industry_alignment = vec![
            ("Defense".to_string(), 0.9),
            ("Pharma".to_string(), 0.5),
            ("Tech".to_string(), 0.3),
        ];
        let signal = compute_donor_alignment_signal(&donor_amounts, &industry_alignment);
        // weighted avg: (50000*0.9 + 100000*0.5 + 25000*0.3) / (50000+100000+25000)
        // = (45000 + 50000 + 7500) / 175000 = 102500 / 175000 ≈ 0.5857
        assert!((signal - 0.5857).abs() < 0.001);
    }

    #[test]
    fn test_donor_alignment_signal_empty_inputs() {
        assert_eq!(compute_donor_alignment_signal(&[], &[]), 0.0);
        assert_eq!(
            compute_donor_alignment_signal(&[("Defense".to_string(), 100.0)], &[]),
            0.0
        );
    }

    #[test]
    fn test_bill_authorship_signal_with_synthetic_data() {
        let similarities = vec![0.85, 0.45, 0.60, 0.10];
        let signal = compute_bill_authorship_signal(&similarities);
        // avg = (0.85 + 0.45 + 0.60 + 0.10) / 4 = 2.0 / 4 = 0.5 * 100 = 50.0
        assert_eq!(signal, 50.0);
    }

    #[test]
    fn test_bill_authorship_signal_empty() {
        assert_eq!(compute_bill_authorship_signal(&[]), 0.0);
    }

    #[test]
    fn test_donor_alignment_signal_full_match() {
        let donor_amounts = vec![("Oil".to_string(), 1_000_000.0)];
        let industry_alignment = vec![("Oil".to_string(), 0.95)];
        let signal = compute_donor_alignment_signal(&donor_amounts, &industry_alignment);
        assert!((signal - 0.95).abs() < 0.001);
    }

    #[test]
    fn test_donor_alignment_signal_zero_donations() {
        let donor_amounts = vec![("Energy".to_string(), 0.0)];
        let industry_alignment = vec![("Energy".to_string(), 0.8)];
        let signal = compute_donor_alignment_signal(&donor_amounts, &industry_alignment);
        assert_eq!(signal, 0.0);
    }

    #[test]
    fn test_bill_authorship_signal_single_perfect_match() {
        let signal = compute_bill_authorship_signal(&[1.0]);
        assert_eq!(signal, 100.0);
    }
}
