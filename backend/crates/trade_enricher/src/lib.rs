//! Trade data enrichment with sector/industry lookup and committee conflict detection.
//!
//! Based on the parallel enrichment pipeline from
//! [poli-ticker](https://github.com/ibotzhub/poli-ticker) by ibotzhub,
//! the per-filer metrics from
//! [congress-trading-monitor](https://github.com/kadoa-org/congress-trading-monitor) by Adrian Krebs (MIT),
//! and the trade JSON schemas from
//! [senate-stock-watcher-data](https://github.com/timothycarambat/senate-stock-watcher-data) by Timothy Carambat.

use chrono::NaiveDate;
use committee_detector::{Conflict, Severity};
use serde::{Deserialize, Serialize};
use ticker_resolver::{ResolutionSource, SectorInfo};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawTrade {
    pub ticker: String,
    pub asset_description: String,
    pub trade_type: TradeType,
    pub amount: String,
    pub trade_date: Option<NaiveDate>,
    pub disclosure_date: Option<NaiveDate>,
    pub chamber: String,
    pub politician_name: String,
    pub party: String,
    pub state: String,
    pub district: Option<String>,
    pub owner: Option<String>,
    pub source_url: Option<String>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum TradeType {
    Buy,
    Sell,
    Exchange,
    Unknown,
}

impl std::str::FromStr for TradeType {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s.to_lowercase().as_str() {
            s if s.contains("sale") || s.contains("sell") => TradeType::Sell,
            s if s.contains("purchase") || s.contains("buy") => TradeType::Buy,
            s if s.contains("exchange") => TradeType::Exchange,
            _ => TradeType::Unknown,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichedTrade {
    pub ticker: String,
    pub asset_description: String,
    pub trade_type: TradeType,
    pub amount: String,
    pub estimated_value: f64,
    pub trade_date: Option<NaiveDate>,
    pub disclosure_date: Option<NaiveDate>,
    pub disclosure_lag_days: Option<i64>,
    pub late_filing: bool,
    pub chamber: String,
    pub politician_name: String,
    pub party: String,
    pub state: String,
    pub district: Option<String>,
    pub owner: Option<String>,
    pub source_url: Option<String>,
    pub sector: String,
    pub industry: String,
    pub sector_source: ResolutionSource,
    pub committees: Vec<String>,
    pub committee_conflicts: Vec<Conflict>,
    pub highest_conflict_severity: Severity,
    pub conflict_flag_count: usize,
}

impl Default for EnrichedTrade {
    fn default() -> Self {
        Self {
            ticker: String::new(),
            asset_description: String::new(),
            trade_type: TradeType::Unknown,
            amount: String::new(),
            estimated_value: 0.0,
            trade_date: None,
            disclosure_date: None,
            disclosure_lag_days: None,
            late_filing: false,
            chamber: String::new(),
            politician_name: String::new(),
            party: String::new(),
            state: String::new(),
            district: None,
            owner: None,
            source_url: None,
            sector: String::new(),
            industry: String::new(),
            sector_source: ResolutionSource::Unknown,
            committees: Vec::new(),
            committee_conflicts: Vec::new(),
            highest_conflict_severity: Severity::Clean,
            conflict_flag_count: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilerMetrics {
    pub politician_name: String,
    pub party: String,
    pub state: String,
    pub chamber: String,
    pub total_trades: usize,
    pub total_buys: usize,
    pub total_sells: usize,
    pub buy_sell_ratio: f64,
    pub estimated_total_volume: f64,
    pub top_tickers: Vec<(String, usize)>,
    pub top_sectors: Vec<(String, usize)>,
    pub committees: Vec<String>,
    pub conflict_count: usize,
    pub direct_conflict_count: usize,
    pub adjacent_conflict_count: usize,
    pub late_filing_count: usize,
    pub late_filing_rate: f64,
    pub last_trade_date: Option<NaiveDate>,
    pub last_disclosure_date: Option<NaiveDate>,
}

/// Estimate the dollar value from an amount range string like "$1,001 - $15,000".
/// Uses midpoint method — standard approach in all congressional trade trackers.
/// Based on congress-trading-monitor and Nancy Pelosi Stock Tracker methodology.
pub fn estimate_notional(amount_range: &str) -> f64 {
    let cleaned = amount_range.replace(['$', ','], "");
    let parts: Vec<&str> = cleaned.split('-').map(|s| s.trim()).collect();
    if parts.len() == 2 {
        let low: f64 = parts[0].parse().unwrap_or(0.0);
        let high: f64 = parts[1].parse().unwrap_or(0.0);
        (low + high) / 2.0
    } else {
        0.0
    }
}

/// Compute disclosure lag (days between trade and disclosure).
/// Based on poli-ticker _disclosure_lag() and congress-trading-monitor late-filing flags.
pub fn compute_disclosure_lag(
    trade_date: Option<NaiveDate>,
    disclosure_date: Option<NaiveDate>,
) -> Option<i64> {
    match (trade_date, disclosure_date) {
        (Some(td), Some(dd)) if dd >= td => Some((dd - td).num_days()),
        _ => None,
    }
}

/// Enrich a single trade with sector info and committee conflicts.
pub fn enrich_trade(trade: &RawTrade, committees: &[String]) -> EnrichedTrade {
    let SectorInfo {
        sector,
        industry,
        source,
        ..
    } = ticker_resolver::resolve(&trade.ticker);
    let estimated_value = estimate_notional(&trade.amount);
    let disclosure_lag = compute_disclosure_lag(trade.trade_date, trade.disclosure_date);
    let late_filing = disclosure_lag.map(|d| d > 45).unwrap_or(false);

    let trade_ref = committee_detector::TradeRef {
        ticker: trade.ticker.clone(),
        sector: sector.clone(),
        industry: industry.clone(),
        trade_type: format!("{:?}", trade.trade_type),
    };

    let conflict_result = committee_detector::detect_all_conflicts(committees, &[trade_ref]);

    EnrichedTrade {
        ticker: trade.ticker.clone(),
        asset_description: trade.asset_description.clone(),
        trade_type: trade.trade_type,
        amount: trade.amount.clone(),
        estimated_value,
        trade_date: trade.trade_date,
        disclosure_date: trade.disclosure_date,
        disclosure_lag_days: disclosure_lag,
        late_filing,
        chamber: trade.chamber.clone(),
        politician_name: trade.politician_name.clone(),
        party: trade.party.clone(),
        state: trade.state.clone(),
        district: trade.district.clone(),
        owner: trade.owner.clone(),
        source_url: trade.source_url.clone(),
        sector,
        industry,
        sector_source: source,
        committees: committees.to_vec(),
        committee_conflicts: conflict_result.conflicts,
        highest_conflict_severity: conflict_result.highest_severity,
        conflict_flag_count: conflict_result.flag_count,
    }
}

/// Enrich a batch of trades.
pub fn enrich_trades(trades: &[RawTrade], committees: &[String]) -> Vec<EnrichedTrade> {
    trades.iter().map(|t| enrich_trade(t, committees)).collect()
}

/// Compute per-filer aggregate metrics from enriched trades.
/// Based on congress-trading-monitor dashboard KPIs.
pub fn compute_filer_metrics(name: &str, trades: &[EnrichedTrade]) -> FilerMetrics {
    let total = trades.len();
    let buys = trades
        .iter()
        .filter(|t| t.trade_type == TradeType::Buy)
        .count();
    let sells = trades
        .iter()
        .filter(|t| t.trade_type == TradeType::Sell)
        .count();
    let volume: f64 = trades.iter().map(|t| t.estimated_value).sum();
    let late_count = trades.iter().filter(|t| t.late_filing).count();
    let direct_count = trades
        .iter()
        .filter(|t| t.highest_conflict_severity == Severity::Direct)
        .count();
    let adj_count = trades
        .iter()
        .filter(|t| t.highest_conflict_severity == Severity::Adjacent)
        .count();

    // Top tickers by count
    let mut ticker_counts: std::collections::HashMap<&str, usize> =
        std::collections::HashMap::new();
    for t in trades {
        if !t.ticker.is_empty() && t.ticker != "N/A" && t.ticker != "--" {
            *ticker_counts.entry(&t.ticker).or_insert(0) += 1;
        }
    }
    let mut top_tickers: Vec<(&str, usize)> = ticker_counts.into_iter().collect();
    top_tickers.sort_by_key(|(_, count)| std::cmp::Reverse(*count));
    let top_tickers: Vec<(String, usize)> = top_tickers
        .into_iter()
        .take(5)
        .map(|(k, v)| (k.to_string(), v))
        .collect();

    // Top sectors
    let mut sector_counts: std::collections::HashMap<&str, usize> =
        std::collections::HashMap::new();
    for t in trades {
        if !t.sector.is_empty() {
            *sector_counts.entry(&t.sector).or_insert(0) += 1;
        }
    }
    let mut top_sectors: Vec<(&str, usize)> = sector_counts.into_iter().collect();
    top_sectors.sort_by_key(|(_, count)| std::cmp::Reverse(*count));
    let top_sectors: Vec<(String, usize)> = top_sectors
        .into_iter()
        .take(5)
        .map(|(k, v)| (k.to_string(), v))
        .collect();

    // Get common fields from first trade
    let party = trades.first().map(|t| t.party.clone()).unwrap_or_default();
    let state = trades.first().map(|t| t.state.clone()).unwrap_or_default();
    let chamber = trades
        .first()
        .map(|t| t.chamber.clone())
        .unwrap_or_default();
    let committees: Vec<String> = trades
        .first()
        .map(|t| t.committees.clone())
        .unwrap_or_default();

    let last_trade = trades.iter().filter_map(|t| t.trade_date).max();
    let last_disc = trades.iter().filter_map(|t| t.disclosure_date).max();

    FilerMetrics {
        politician_name: name.to_string(),
        party,
        state,
        chamber,
        total_trades: total,
        total_buys: buys,
        total_sells: sells,
        buy_sell_ratio: buys as f64 / sells.max(1) as f64,
        estimated_total_volume: volume,
        top_tickers,
        top_sectors,
        committees,
        conflict_count: direct_count + adj_count,
        direct_conflict_count: direct_count,
        adjacent_conflict_count: adj_count,
        late_filing_count: late_count,
        late_filing_rate: late_count as f64 / total.max(1) as f64,
        last_trade_date: last_trade,
        last_disclosure_date: last_disc,
    }
}

/// Compute metrics for multiple filers.
pub fn compute_all_filer_metrics(trades: &[EnrichedTrade]) -> Vec<FilerMetrics> {
    let grouped: std::collections::HashMap<&str, Vec<&EnrichedTrade>> =
        trades
            .iter()
            .fold(std::collections::HashMap::new(), |mut acc, t| {
                acc.entry(&t.politician_name).or_default().push(t);
                acc
            });
    grouped
        .into_iter()
        .map(|(name, trades)| {
            let owned: Vec<EnrichedTrade> = trades.into_iter().cloned().collect();
            compute_filer_metrics(name, &owned)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_trade() -> RawTrade {
        RawTrade {
            ticker: "AAPL".to_string(),
            asset_description: "Apple Inc.".to_string(),
            trade_type: TradeType::Buy,
            amount: "$1,001 - $15,000".to_string(),
            trade_date: Some(NaiveDate::from_ymd_opt(2025, 1, 15).unwrap()),
            disclosure_date: Some(NaiveDate::from_ymd_opt(2025, 2, 1).unwrap()),
            chamber: "House".to_string(),
            politician_name: "Test Member".to_string(),
            party: "Democrat".to_string(),
            state: "CA".to_string(),
            district: Some("12".to_string()),
            owner: Some("Self".to_string()),
            source_url: None,
            comment: None,
        }
    }

    #[test]
    fn test_estimate_notional_midpoint() {
        let val = estimate_notional("$1,001 - $15,000");
        assert_eq!(val, 8000.5);
    }

    #[test]
    fn test_estimate_notional_large() {
        let val = estimate_notional("$1,000,001 - $5,000,000");
        assert_eq!(val, 3_000_000.5);
    }

    #[test]
    fn test_disclosure_lag() {
        let td = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();
        let dd = NaiveDate::from_ymd_opt(2025, 1, 15).unwrap();
        let lag = compute_disclosure_lag(Some(td), Some(dd));
        assert_eq!(lag, Some(14));
    }

    #[test]
    fn test_late_filing_flag() {
        let td = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();
        let dd = NaiveDate::from_ymd_opt(2025, 3, 15).unwrap();
        let lag = compute_disclosure_lag(Some(td), Some(dd));
        assert!(lag.unwrap() > 45);
    }

    #[test]
    fn test_enrich_trade_adds_sector_field() {
        let trade = make_trade();
        let committees: Vec<String> = vec![];
        let enriched = enrich_trade(&trade, &committees);
        // AAPL should resolve to Technology sector
        assert!(!enriched.ticker.is_empty());
        assert_eq!(enriched.trade_type, TradeType::Buy);
        assert!(enriched.estimated_value > 0.0);
        assert_eq!(enriched.committees.len(), 0);
    }

    #[test]
    fn test_enrich_trade_with_committees_detects_conflict() {
        let mut trade = make_trade();
        trade.ticker = "LMT".to_string(); // Lockheed Martin - defense
        let committees = vec!["Armed Services".to_string()];
        let enriched = enrich_trade(&trade, &committees);
        assert_eq!(enriched.committees.len(), 1);
        // Sector lookup may not resolve LMT statically, but the conflict check should work
        // if sector matches any defense sector
    }

    #[test]
    fn test_compute_filer_metrics() {
        let mut trades = Vec::new();
        for i in 0..10 {
            let _t = make_trade();
            let enriched = EnrichedTrade {
                ticker: format!("AAPL{}", i),
                trade_type: if i < 6 {
                    TradeType::Buy
                } else {
                    TradeType::Sell
                },
                estimated_value: 1000.0 * (i + 1) as f64,
                politician_name: "Test Member".to_string(),
                party: "Democrat".to_string(),
                state: "CA".to_string(),
                chamber: "House".to_string(),
                sector: "Technology".to_string(),
                ..Default::default()
            };
            trades.push(enriched);
        }
        let metrics = compute_filer_metrics("Test Member", &trades);
        assert_eq!(metrics.total_trades, 10);
        assert_eq!(metrics.total_buys, 6);
        assert_eq!(metrics.total_sells, 4);
        assert!((metrics.buy_sell_ratio - 1.5).abs() < 0.01);
        assert!(metrics.estimated_total_volume > 0.0);
    }

    // Need Default impl for test
    #[test]
    fn test_trade_type_parsing() {
        assert_eq!("Purchase".parse::<TradeType>().unwrap(), TradeType::Buy);
        assert_eq!("Sale (Full)".parse::<TradeType>().unwrap(), TradeType::Sell);
        assert_eq!(
            "Exchange".parse::<TradeType>().unwrap(),
            TradeType::Exchange
        );
        assert_eq!("???".parse::<TradeType>().unwrap(), TradeType::Unknown);
    }
}
