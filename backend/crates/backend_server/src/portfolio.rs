use std::collections::HashMap;
use std::sync::Arc;

use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use capitoltrades_api::{
    types::{PoliticianDetail, Sector, Trade, TxType},
    Client as CapitolTradesClient, PoliticianQuery, Query, TradeQuery,
};
use serde::Serialize;

use crate::AppState;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/portfolio/summary", get(summary))
        .route("/api/portfolio/featured", get(featured))
        .route("/api/portfolio/top-members", get(top_members))
        .route("/api/portfolio/sector-exposure", get(sector_exposure))
        .route("/api/portfolio/market-pulse", get(market_pulse))
}

#[derive(Serialize)]
struct PortfolioSummary {
    total_politicians: i64,
    total_trades: i64,
    buy_orders: i64,
    sell_orders: i64,
    net_activity: i64,
    timely_disclosure_rate: f64,
    total_volume: i64,
}

async fn summary(
    State(state): State<Arc<AppState>>,
) -> Result<Json<PortfolioSummary>, (StatusCode, String)> {
    let trades = fetch_sample_trades(&state.capitoltrades, 200).await?;
    let politicians = fetch_all_politicians(&state.capitoltrades).await?;

    let total_politicians = politicians.len() as i64;
    let total_trades = get_total_trade_count(&state.capitoltrades)
        .await
        .unwrap_or(0);

    let buy_orders = trades
        .iter()
        .filter(|t| matches!(t.tx_type, TxType::Buy))
        .count() as i64;
    let sell_orders = trades
        .iter()
        .filter(|t| matches!(t.tx_type, TxType::Sell))
        .count() as i64;
    let net_activity = buy_orders - sell_orders;

    let total_sample = trades.len() as f64;
    let timely = trades
        .iter()
        .filter(|t| t.reporting_gap >= 0 && t.reporting_gap <= 45)
        .count() as f64;
    let timely_disclosure_rate = if total_sample > 0.0 {
        (timely / total_sample * 10000.0).round() / 100.0
    } else {
        0.0
    };

    let total_volume: i64 = politicians.iter().filter_map(|p| p.stats.volume).sum();

    Ok(Json(PortfolioSummary {
        total_politicians,
        total_trades,
        buy_orders,
        sell_orders,
        net_activity,
        timely_disclosure_rate,
        total_volume,
    }))
}

#[derive(Serialize, Clone)]
struct FeaturedPortfolio {
    member: FeaturedMember,
    trade_count: i64,
    estimated_return_pct: f64,
    top_holdings: Vec<HoldingInfo>,
    asset_allocation: Vec<SectorWeight>,
}

#[derive(Serialize, Clone)]
struct FeaturedMember {
    name: String,
    party: String,
    state: String,
    chamber: String,
    total_trades: i64,
    volume: i64,
    buy_count: i64,
    sell_count: i64,
    image_url: Option<String>,
}

#[derive(Serialize, Clone)]
struct HoldingInfo {
    ticker: String,
    name: String,
    trades: i64,
    percentage: f64,
}

#[derive(Serialize, Clone)]
struct SectorWeight {
    sector: String,
    weight: f64,
    trade_count: i64,
    volume: i64,
}

async fn featured(
    State(state): State<Arc<AppState>>,
) -> Result<Json<FeaturedPortfolio>, (StatusCode, String)> {
    let trades = fetch_sample_trades(&state.capitoltrades, 200).await?;

    let mut politician_trade_counts: HashMap<&str, Vec<&Trade>> = HashMap::new();
    for t in &trades {
        politician_trade_counts
            .entry(&t.politician_id)
            .or_default()
            .push(t);
    }

    let (pid, member_trades) = politician_trade_counts
        .iter()
        .max_by_key(|(_, v)| v.len())
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                "No trades with politician data found".to_string(),
            )
        })?;

    let top_politician = member_trades
        .first()
        .map(|t| &t.politician)
        .ok_or_else(|| (StatusCode::NOT_FOUND, "No politician data".to_string()))?;

    let buy_count = member_trades
        .iter()
        .filter(|t| matches!(t.tx_type, TxType::Buy))
        .count() as i64;
    let sell_count = member_trades
        .iter()
        .filter(|t| matches!(t.tx_type, TxType::Sell))
        .count() as i64;

    let featured = FeaturedMember {
        name: format!("{} {}", top_politician.first_name, top_politician.last_name)
            .trim()
            .to_string(),
        party: format_party(Some(top_politician.party.clone())),
        chamber: format_chamber(Some(top_politician.chamber)),
        state: top_politician.state_id.clone(),
        total_trades: member_trades.len() as i64,
        volume: member_trades.iter().map(|t| t.value).sum(),
        buy_count,
        sell_count,
        image_url: Some(format!(
            "https://www.congress.gov/img/member/{}_200.jpg",
            pid.to_lowercase()
        )),
    };

    let top_holdings = compute_top_holdings(&member_trades, 5);
    let asset_allocation = compute_sector_allocation_volume(&member_trades);

    Ok(Json(FeaturedPortfolio {
        member: featured,
        trade_count: member_trades.len() as i64,
        estimated_return_pct: 0.0,
        top_holdings,
        asset_allocation,
    }))
}

#[derive(Serialize)]
struct TopMembersResponse {
    members: Vec<MemberRank>,
    total: i64,
}

#[derive(Serialize)]
struct MemberRank {
    rank: i64,
    name: String,
    party: String,
    state: String,
    chamber: String,
    total_trades: i64,
    volume: i64,
    buy_count: i64,
    sell_count: i64,
    net_activity: i64,
    estimated_return_pct: f64,
    image_url: Option<String>,
}

async fn top_members(
    State(state): State<Arc<AppState>>,
) -> Result<Json<TopMembersResponse>, (StatusCode, String)> {
    let politicians = fetch_all_politicians(&state.capitoltrades).await?;

    let mut sorted: Vec<_> = politicians
        .iter()
        .filter(|p| {
            p.first_name.as_deref().unwrap_or("").len() + p.last_name.as_deref().unwrap_or("").len()
                > 0
        })
        .map(|p| {
            let pid = p.politician_id.clone();
            MemberRank {
                rank: 0,
                name: format!(
                    "{} {}",
                    p.first_name.as_deref().unwrap_or(""),
                    p.last_name.as_deref().unwrap_or("")
                )
                .trim()
                .to_string(),
                party: format_party(p.party.clone()),
                chamber: format_chamber(p.chamber),
                state: p.state_id.clone().unwrap_or_default(),
                total_trades: p.stats.count_trades.unwrap_or(0),
                volume: p.stats.volume.unwrap_or(0),
                buy_count: 0,
                sell_count: 0,
                net_activity: 0,
                estimated_return_pct: 0.0,
                image_url: Some(format!(
                    "https://www.congress.gov/img/member/{}_200.jpg",
                    pid.to_lowercase()
                )),
            }
        })
        .collect();

    sorted.sort_by(|a, b| b.total_trades.cmp(&a.total_trades));
    for (i, m) in sorted.iter_mut().enumerate() {
        m.rank = (i + 1) as i64;
    }

    Ok(Json(TopMembersResponse {
        total: sorted.len() as i64,
        members: sorted,
    }))
}

#[derive(Serialize)]
struct SectorExposureResponse {
    basis: String,
    sectors: Vec<SectorWeight>,
    sp500_comparison_pct: f64,
}

async fn sector_exposure(
    State(state): State<Arc<AppState>>,
) -> Result<Json<SectorExposureResponse>, (StatusCode, String)> {
    let trades = fetch_sample_trades(&state.capitoltrades, 500).await?;
    let trade_refs: Vec<&Trade> = trades.iter().collect();
    let sectors = compute_sector_allocation_volume(&trade_refs);

    Ok(Json(SectorExposureResponse {
        basis: "transaction_volume_sample".to_string(),
        sectors,
        sp500_comparison_pct: 0.0,
    }))
}

#[derive(Serialize)]
struct MarketPulseResponse {
    most_traded_ticker: String,
    most_traded_count: i64,
    most_traded_company: String,
    trending_sector: String,
    trending_sector_weight: f64,
    timely_disclosure_rate: f64,
    total_trades_sampled: i64,
}

async fn market_pulse(
    State(state): State<Arc<AppState>>,
) -> Result<Json<MarketPulseResponse>, (StatusCode, String)> {
    let trades = fetch_sample_trades(&state.capitoltrades, 500).await?;

    let mut ticker_counts: HashMap<String, (i64, String)> = HashMap::new();
    for t in &trades {
        let ticker = t
            .issuer
            .issuer_ticker
            .clone()
            .or_else(|| t.asset.as_ref().and_then(|a| a.asset_ticker.clone()))
            .unwrap_or_else(|| "N/A".to_string());
        let company = t.issuer.issuer_name.clone();
        let entry = ticker_counts.entry(ticker).or_insert((0, company));
        entry.0 += 1;
    }

    let most_traded = ticker_counts
        .into_iter()
        .max_by_key(|(_, (c, _))| *c)
        .unwrap_or_else(|| ("N/A".to_string(), (0, "Unknown".to_string())));

    let trade_refs: Vec<&Trade> = trades.iter().collect();
    let sectors = compute_sector_allocation_volume(&trade_refs);

    let trending = sectors.first().cloned().unwrap_or(SectorWeight {
        sector: "N/A".to_string(),
        weight: 0.0,
        trade_count: 0,
        volume: 0,
    });

    let total_sample = trades.len() as f64;
    let timely = trades
        .iter()
        .filter(|t| t.reporting_gap >= 0 && t.reporting_gap <= 45)
        .count() as f64;
    let compliant_rate = if total_sample > 0.0 {
        (timely / total_sample * 10000.0).round() / 100.0
    } else {
        0.0
    };

    Ok(Json(MarketPulseResponse {
        most_traded_ticker: most_traded.0,
        most_traded_count: (most_traded.1).0,
        most_traded_company: (most_traded.1).1,
        trending_sector: trending.sector,
        trending_sector_weight: trending.weight,
        timely_disclosure_rate: compliant_rate,
        total_trades_sampled: trades.len() as i64,
    }))
}

async fn fetch_sample_trades(
    client: &CapitolTradesClient,
    max_trades: usize,
) -> Result<Vec<Trade>, (StatusCode, String)> {
    let mut all_trades = Vec::new();
    let mut page: i64 = 1;

    while all_trades.len() < max_trades {
        let query = TradeQuery::default().with_page(page).with_page_size(50);
        match client.get_trades(&query).await {
            Ok(response) => {
                let len_before = all_trades.len();
                let total = response.meta.paging.total_items;
                all_trades.extend(response.data);
                if len_before == all_trades.len() || all_trades.len() >= total as usize {
                    break;
                }
            }
            Err(e) => {
                tracing::warn!("Failed to fetch trades page {}: {:?}", page, e);
                break;
            }
        }
        page += 1;
        if page > 50 {
            break;
        }
    }

    Ok(all_trades)
}

async fn get_total_trade_count(client: &CapitolTradesClient) -> Result<i64, (StatusCode, String)> {
    let query = TradeQuery::default().with_page_size(1);
    client
        .get_trades(&query)
        .await
        .map(|r| r.meta.paging.total_items)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch trade count: {:?}", e),
            )
        })
}

async fn fetch_all_politicians(
    client: &CapitolTradesClient,
) -> Result<Vec<PoliticianDetail>, (StatusCode, String)> {
    let query = PoliticianQuery::default().with_page_size(250);
    client
        .get_politicians(&query)
        .await
        .map(|r| r.data)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch politicians: {:?}", e),
            )
        })
}

fn format_party(party: Option<capitoltrades_api::types::Party>) -> String {
    match party {
        Some(p) => match p {
            capitoltrades_api::types::Party::Democrat => "Democrat".to_string(),
            capitoltrades_api::types::Party::Republican => "Republican".to_string(),
            capitoltrades_api::types::Party::Other => "Independent".to_string(),
        },
        None => "Unknown".to_string(),
    }
}

fn format_chamber(chamber: Option<capitoltrades_api::types::Chamber>) -> String {
    match chamber {
        Some(c) => match c {
            capitoltrades_api::types::Chamber::House => "House".to_string(),
            capitoltrades_api::types::Chamber::Senate => "Senate".to_string(),
        },
        None => "Congress".to_string(),
    }
}

fn classify_issuer_sector(name: &str) -> Sector {
    let lower = name.to_lowercase();
    if lower.contains("tech")
        || lower.contains("software")
        || lower.contains("semiconductor")
        || lower.contains("cloud")
        || lower.contains("cyber")
        || lower.contains("data")
        || lower.contains("electronic")
        || lower.contains("digital")
        || lower.contains("internet")
        || lower.contains("computer")
        || lower.contains("information")
    {
        Sector::InformationTechnology
    } else if lower.contains("bank")
        || lower.contains("financ")
        || lower.contains("insur")
        || lower.contains("invest")
        || lower.contains("capital")
        || lower.contains("credit")
        || lower.contains("loan")
        || lower.contains("mortgage")
        || lower.contains("asset management")
        || lower.contains("private equity")
        || lower.contains("venture")
        || lower.contains("payment")
        || lower.contains("exchange")
    {
        Sector::Financials
    } else if lower.contains("health")
        || lower.contains("pharma")
        || lower.contains("bio")
        || lower.contains("medical")
        || lower.contains("drug")
        || lower.contains("therapeutic")
        || lower.contains("diagnostic")
        || lower.contains("hospital")
        || lower.contains("clinic")
        || lower.contains("surgery")
        || lower.contains("genetic")
    {
        Sector::HealthCare
    } else if lower.contains("energy")
        || lower.contains("oil")
        || lower.contains("gas")
        || lower.contains("solar")
        || lower.contains("wind")
        || lower.contains("renewable")
        || lower.contains("drilling")
        || lower.contains("pipeline")
        || lower.contains("refinin")
        || lower.contains("petroleum")
        || lower.contains("fuel")
    {
        Sector::Energy
    } else if lower.contains("industr")
        || lower.contains("manufact")
        || lower.contains("aerospace")
        || lower.contains("defense")
        || lower.contains("machinery")
        || lower.contains("construction")
        || lower.contains("engineer")
        || lower.contains("logistic")
        || lower.contains("transport")
        || lower.contains("rail")
        || lower.contains("shipping")
        || lower.contains("freight")
        || lower.contains("airline")
    {
        Sector::Industrials
    } else if lower.contains("retail")
        || lower.contains("auto")
        || lower.contains("restaurant")
        || lower.contains("hotel")
        || lower.contains("entertainment")
        || lower.contains("travel")
        || lower.contains("luxury")
        || lower.contains("apparel")
        || lower.contains("fashion")
        || lower.contains("consumer discretionary")
        || lower.contains("gaming")
        || lower.contains("casino")
        || lower.contains("resort")
        || lower.contains("cruise")
    {
        Sector::ConsumerDiscretionary
    } else if lower.contains("consumer staple")
        || lower.contains("food")
        || lower.contains("beverage")
        || lower.contains("grocery")
        || lower.contains("household")
        || lower.contains("personal care")
        || lower.contains("tobacco")
        || lower.contains("agriculture")
    {
        Sector::ConsumerStaples
    } else if lower.contains("real estate")
        || lower.contains("reit")
        || lower.contains("property")
        || lower.contains("realty")
    {
        Sector::RealEstate
    } else if lower.contains("telecom")
        || lower.contains("media")
        || lower.contains("broadcast")
        || lower.contains("communication")
        || lower.contains("network")
        || lower.contains("wireless")
        || lower.contains("cable")
        || lower.contains("streaming")
    {
        Sector::CommunicationServices
    } else if lower.contains("material")
        || lower.contains("chemical")
        || lower.contains("metal")
        || lower.contains("mining")
        || lower.contains("steel")
        || lower.contains("paper")
        || lower.contains("packaging")
        || lower.contains("gold")
        || lower.contains("copper")
        || lower.contains("timber")
    {
        Sector::Materials
    } else if lower.contains("utilit")
        || lower.contains("electric")
        || lower.contains("water")
        || lower.contains("power")
        || lower.contains("waste management")
    {
        Sector::Utilities
    } else {
        Sector::Other
    }
}

fn sector_display_name(sector: &Sector) -> &str {
    match sector {
        Sector::InformationTechnology => "Technology",
        Sector::Financials => "Financials",
        Sector::HealthCare => "Healthcare",
        Sector::Energy => "Energy",
        Sector::Industrials => "Industrials",
        Sector::ConsumerDiscretionary => "Consumer Cyclical",
        Sector::ConsumerStaples => "Consumer Staples",
        Sector::RealEstate => "Real Estate",
        Sector::CommunicationServices => "Communication Services",
        Sector::Materials => "Materials",
        Sector::Utilities => "Utilities",
        Sector::Other => "Other",
    }
}

fn compute_top_holdings(trades: &[&Trade], top_n: usize) -> Vec<HoldingInfo> {
    let mut ticker_map: HashMap<String, (String, i64)> = HashMap::new();
    for t in trades {
        let ticker = t
            .issuer
            .issuer_ticker
            .clone()
            .or_else(|| t.asset.as_ref().and_then(|a| a.asset_ticker.clone()))
            .unwrap_or_else(|| "N/A".to_string());
        let company = t.issuer.issuer_name.clone();
        let entry = ticker_map.entry(ticker).or_insert((company, 0));
        entry.1 += 1;
    }

    let mut sorted: Vec<_> = ticker_map.into_iter().collect();
    sorted.sort_by(|a, b| b.1 .1.cmp(&a.1 .1));
    let total_trades: i64 = sorted.iter().map(|(_, (_, c))| c).sum();

    sorted
        .into_iter()
        .take(top_n)
        .map(|(ticker, (name, count))| HoldingInfo {
            ticker,
            name,
            trades: count,
            percentage: if total_trades > 0 {
                ((count as f64 / total_trades as f64) * 1000.0).round() / 10.0
            } else {
                0.0
            },
        })
        .collect()
}

fn compute_sector_allocation_volume(trades: &[&Trade]) -> Vec<SectorWeight> {
    let mut sector_map: HashMap<String, (i64, i64)> = HashMap::new();
    for t in trades {
        let sector = classify_issuer_sector(&t.issuer.issuer_name);
        let name = sector_display_name(&sector).to_string();
        let entry = sector_map.entry(name).or_insert((0, 0));
        entry.0 += 1;
        entry.1 += t.value;
    }

    let total_trades: i64 = sector_map.values().map(|(c, _)| c).sum();

    let mut sorted: Vec<_> = sector_map.into_iter().collect();
    sorted.sort_by(|a, b| b.1 .0.cmp(&a.1 .0));

    sorted
        .into_iter()
        .map(|(sector, (count, volume))| SectorWeight {
            sector,
            weight: if total_trades > 0 {
                ((count as f64 / total_trades as f64) * 1000.0).round() / 10.0
            } else {
                0.0
            },
            trade_count: count,
            volume,
        })
        .collect()
}
