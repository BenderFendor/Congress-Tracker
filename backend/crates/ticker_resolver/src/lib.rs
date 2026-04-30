//! Stock ticker to sector/industry resolver.
//!
//! Based on the sector-industry mapping and Yahoo Finance API integration from
//! [yfinance](https://github.com/ranaroussi/yfinance) by Ran Aroussi (Apache 2.0),
//! and the static ticker database concept from
//! [FinanceDatabase](https://github.com/jerbouma/FinanceDatabase) by Jeroen Bouma (MIT).

pub mod mapping;

use std::collections::HashMap;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SectorInfo {
    pub ticker: String,
    pub sector: String,
    pub industry: String,
    pub source: ResolutionSource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum ResolutionSource {
    StaticMap,
    YahooApi,
    Unknown,
}

pub fn resolve(ticker: &str) -> SectorInfo {
    let clean = ticker.trim().to_uppercase().replace('$', "");
    if clean.is_empty() || clean.len() > 10 || clean == "--" || clean == "N/A" {
        return SectorInfo {
            ticker: clean,
            sector: String::new(),
            industry: String::new(),
            source: ResolutionSource::Unknown,
        };
    }
    SectorInfo {
        ticker: clean,
        sector: String::new(),
        industry: String::new(),
        source: ResolutionSource::Unknown,
    }
}

pub fn resolve_batch(tickers: &[&str]) -> HashMap<String, SectorInfo> {
    tickers
        .iter()
        .map(|t| {
            let info = resolve(t);
            (info.ticker.clone(), info)
        })
        .collect()
}

pub fn all_sectors() -> Vec<&'static str> {
    mapping::SECTOR_INDUSTRY_MAP.keys().copied().collect()
}

pub fn industries_for_sector(sector: &str) -> Option<&'static [&'static str]> {
    mapping::SECTOR_INDUSTRY_MAP.get(sector).copied()
}

pub fn sector_for_industry(industry: &str) -> Option<&'static str> {
    for (&sector, industries) in mapping::SECTOR_INDUSTRY_MAP.entries() {
        if industries.contains(&industry) {
            return Some(sector);
        }
    }
    None
}

#[cfg(feature = "remote")]
pub async fn resolve_remote(
    ticker: &str,
) -> Result<SectorInfo, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!(
        "https://query2.finance.yahoo.com/v10/finance/quoteSummary/{}?modules=assetProfile",
        ticker
    );
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        )
        .send()
        .await?;
    let body: serde_json::Value = resp.json().await?;
    let profile = &body["quoteSummary"]["result"][0]["assetProfile"];
    let sector = profile["sector"].as_str().unwrap_or("").to_string();
    let industry = profile["industry"].as_str().unwrap_or("").to_string();
    Ok(SectorInfo {
        ticker: ticker.to_string(),
        sector,
        industry,
        source: ResolutionSource::YahooApi,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_empty() {
        let info = resolve("");
        assert_eq!(info.source, ResolutionSource::Unknown);
        assert!(info.sector.is_empty());
    }

    #[test]
    fn test_resolve_na() {
        let info = resolve("N/A");
        assert_eq!(info.source, ResolutionSource::Unknown);
        assert!(info.sector.is_empty());
    }

    #[test]
    fn test_resolve_cleans_ticker() {
        let info = resolve("$AAPL");
        assert_eq!(info.ticker, "AAPL");
    }

    #[test]
    fn test_resolve_batch() {
        let results = resolve_batch(&["AAPL", "N/A", ""]);
        assert_eq!(results.len(), 3);
        assert!(results.contains_key("AAPL"));
    }

    #[test]
    fn test_all_sectors_has_11() {
        let sectors = all_sectors();
        assert_eq!(sectors.len(), 11);
    }

    #[test]
    fn test_industries_for_sector() {
        let tech = industries_for_sector("Technology").unwrap();
        assert!(tech.contains(&"Semiconductors"));
    }

    #[test]
    fn test_sector_for_industry() {
        let sector = sector_for_industry("Semiconductors");
        assert_eq!(sector, Some("Technology"));
    }

    #[test]
    fn test_sector_for_industry_unknown() {
        let sector = sector_for_industry("NonexistentIndustry");
        assert_eq!(sector, None);
    }
}
