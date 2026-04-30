"use client"

import React, { useState, useEffect } from 'react';
import { Search, Grid, List, Info, Calendar, Shield, Users, TrendingUp, PieChart, FileText, DollarSign, BarChart3 } from 'lucide-react';
import { NavBarItem } from '@/components/ui/design-system/NavBarItem';
import { SectionHeader } from '@/components/ui/design-system/SectionHeader';
import { StatBox } from '@/components/ui/design-system/StatBox';
import { DataGrid } from '@/components/ui/design-system/DataGrid';
import { LegislatorCard } from '@/components/ui/design-system/LegislatorCard';
import { Briefing } from '@/components/ui/design-system/Briefing';

import { getAllLegislators, Legislator } from '@/lib/services/legislators';
import { getRecentTrades, StockTrade } from '@/lib/services/stocks';
import { getRecentFilings, Filing } from '@/lib/services/lobbying';
import { getRecentBills, Bill } from '@/lib/services/bills';
import { getEnrichedTrades, EnrichedTrade, getAnomalyScores, AnomalyScore } from '@/lib/services/enrichment';

export default function CongressTracker() {
  const [activeTab, setActiveTab] = useState('overview');
  const [animKey, setAnimKey] = useState(0);

  // State for real data
  const [legislators, setLegislators] = useState<Legislator[]>([]);
  const [trades, setTrades] = useState<StockTrade[]>([]);
  const [enrichedTrades, setEnrichedTrades] = useState<EnrichedTrade[]>([]);
  const [anomalyScores, setAnomalyScores] = useState<AnomalyScore[]>([]);
  const [filings, setFilings] = useState<Filing[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAnimKey(prev => prev + 1);
  }, [activeTab]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [legislatorsData, tradesData, filingsData, billsData, enrichedData, anomalyScoresData] = await Promise.all([
          getAllLegislators('house', 118),
          getRecentTrades(10),
          getRecentFilings(1, 5),
          getRecentBills(5),
          getEnrichedTrades({ limit: 50 }).catch(() => []),
          getAnomalyScores().catch(() => []),
        ]);

        setLegislators(legislatorsData.slice(0, 6));
        setTrades(tradesData);
        setEnrichedTrades(enrichedData);
        setAnomalyScores(anomalyScoresData);
        setFilings(filingsData.results || []);
        setBills(billsData);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Derived Briefing Items from real data
  const briefingItems = [
    ...bills.slice(0, 1).map(b => ({ id: 'LEGISLATION', text: `New Bill: ${b.title}`, date: b.date })),
    ...trades.slice(0, 1).map(t => ({ id: 'TRADING', text: `${t.representative} ${(t.type || "").toLowerCase()} ${t.ticker} (${t.amount})`, date: t.transaction_date })),
    ...filings.slice(0, 1).map(f => ({ id: 'LOBBYING', text: `${f.registrant.name} filed report for ${f.client?.name || 'Self'}`, date: f.dt_posted.split('T')[0] }))
  ];

  // Fallback if data is empty
  const displayBriefing = briefingItems.length > 0 ? briefingItems : [
    { id: 'SYSTEM', text: "Loading real-time data streams...", date: "Now" }
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-[#0B1D3A] border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div key={animKey} className="pb-12">
            <div className="relative mb-24 max-w-4xl animate-stagger-item delay-1">
              {/* Dynamic decorative elements */}
              <div className="absolute -top-20 -left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl -z-10" style={{ animation: 'pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
              <div className="absolute top-40 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -z-10" style={{ animation: 'pulse-slow 5s cubic-bezier(0.4, 0, 0.6, 1) infinite', animationDelay: '1s' }}></div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 mb-8 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Data Feed Active</span>
              </div>

              <h1 className="font-serif text-6xl md:text-8xl leading-[1.1] mb-6 text-primary tracking-tighter">
                <span className="inline-block hover:translate-x-2 transition-transform duration-300">Public</span> <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-muted-foreground to-primary/70 inline-block">Transparency</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl font-light mb-10 border-l-4 border-accent/30 pl-6">
                Real-time monitoring of federal legislative activity, financial disclosures, and lobbying records.
              </p>

              <div className="flex flex-wrap gap-4 animate-stagger-item delay-2">
                <button onClick={() => setActiveTab('legislators')} className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-sm hover:bg-primary/90 transition-all hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2 group">
                  <Search size={18} className="group-hover:-rotate-12 transition-transform duration-300" />
                  Explore Legislators
                </button>
                <button onClick={() => setActiveTab('stocks')} className="px-6 py-3 bg-card border border-border text-foreground font-medium rounded-sm hover:border-primary hover:text-primary transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center gap-2 group">
                  <TrendingUp size={18} className="group-hover:-translate-y-1 transition-transform duration-300" />
                  Market Activity
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
              <StatBox label="Active Members" value="535" delay="delay-1" />
              <StatBox label="Recent Bills" value={bills.length > 0 ? "15K+" : "Loading..."} trend="Active Session" delay="delay-2" />
              <StatBox label="Lobbying Reports" value={filings.length > 0 ? "20K+" : "Loading..."} trend="Q3 2024" delay="delay-3" />
              <StatBox label="Recent Trades" value={trades.length > 0 ? "10K+" : "Loading..."} trend="High Activity" delay="delay-4" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 border-t border-border pt-12 animate-stagger-item delay-5">
              <Briefing items={displayBriefing} />

              <div className="bg-card p-8 border border-border rounded-sm shadow-sm hover:shadow-md transition-shadow duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <Info className="text-primary" size={20} />
                  <h3 className="text-[12px] font-semibold uppercase tracking-wide text-primary">Data Sources</h3>
                </div>

                <div className="space-y-6 font-serif text-foreground leading-relaxed">
                  <p>
                    <strong className="font-sans font-medium text-muted-foreground">Legislators & Bills:</strong> Congress.gov API
                  </p>
                  <p>
                    <strong className="font-sans font-medium text-muted-foreground">Lobbying:</strong> Senate LDA API
                  </p>
                  <p>
                    <strong className="font-sans font-medium text-muted-foreground">Financials:</strong> STOCK Act Disclosures (Mock/ProPublica)
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar size={14} />
                    <span className="text-[11px] font-medium uppercase tracking-wide">Last Updated: {new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'legislators':
        return (
          <div key={animKey}>
            <SectionHeader title="Legislator Directory" subtitle="118th Congress" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {legislators.map((l, i) => (
                <LegislatorCard
                  key={l.id}
                  id={l.id}
                  name={l.name}
                  state={l.state}
                  party={l.party}
                  age={0}
                  cash={l.trade_summary ? `$${((l.trade_summary.stats.volume || 0) / 1000000).toFixed(1)}M` : "No trades"}
                  risk={l.trade_summary?.stats.count_trades && l.trade_summary.stats.count_trades > 20 ? 'High' : l.trade_summary ? 'Med' : 'Low'}
                  delay={`delay-${(i % 5) + 1}`}
                />
              ))}
            </div>
          </div>
        );

      case 'stocks':
        return (
          <div key={animKey}>
            <SectionHeader title="Financial Disclosures" subtitle="Recent Transactions" />
            <DataGrid headers={['Ticker', 'Company', 'Type', 'Amount', 'Date', 'Official']}>
              {trades.map((t, i) => (
                <div key={i} className={`grid grid-cols-6 hover:bg-muted transition-colors items-center group animate-stagger-item delay-${(i % 5) + 1}`}>
                  <div className="p-4 border-r border-border font-semibold text-primary group-hover:pl-5 transition-all">{t.ticker}</div>
                  <div className="p-4 border-r border-border text-foreground truncate">{t.asset_description}</div>
                  <div className={`p-4 border-r border-border font-medium ${(t.type || "").includes('sale') ? 'text-[#DC2626]' : 'text-[#059669]'}`}>{(t.type || "").toUpperCase()}</div>
                  <div className="p-4 border-r border-border text-foreground">{t.amount}</div>
                  <div className="p-4 border-r border-border text-muted-foreground">{t.transaction_date}</div>
                  <div className="p-4 font-serif text-primary group-hover:text-accent transition-colors">{t.representative}</div>
                </div>
              ))}
            </DataGrid>
          </div>
        );

      case 'bills':
        return (
          <div key={animKey}>
            <SectionHeader title="Recent Legislation" subtitle="Active Bills" />
            <DataGrid headers={['ID', 'Title', 'Status', 'Date']}>
              {bills.map((b, i) => (
                <div key={i} className={`grid grid-cols-4 hover:bg-muted transition-colors items-center group animate-stagger-item delay-${(i % 5) + 1}`}>
                  <div className="p-4 border-r border-border font-semibold text-primary">{b.id}</div>
                  <div className="p-4 border-r border-border text-foreground">{b.title}</div>
                  <div className="p-4 border-r border-border text-foreground">{b.status}</div>
                  <div className="p-4 text-muted-foreground">{b.date}</div>
                </div>
              ))}
            </DataGrid>
          </div>
        );

      case 'networth': {
        const totalVolume = enrichedTrades.reduce((sum, t) => sum + t.estimated_value, 0);
        const memberCount = new Set(enrichedTrades.map((t) => t.politician_name)).size;
        return (
          <div key={animKey}>
            <SectionHeader title="Wealth Analysis" subtitle="Net Worth Estimates" actionLabel="Full Analysis" onAction={() => window.location.href = '/networth'} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatBox label="Estimated Volume" value={totalVolume > 0 ? `$${(totalVolume / 1e6).toFixed(1)}M` : "No data"} trend="CapitolTrades" delay="delay-1" />
              <StatBox label="Trades Analyzed" value={enrichedTrades.length} trend="STOCK Act" delay="delay-2" />
              <StatBox label="Members Active" value={memberCount} trend="Current Session" delay="delay-3" />
            </div>
            <div className="bg-card border border-border rounded-sm shadow-sm p-8">
              <p className="text-muted-foreground leading-relaxed">
                Net worth estimates are derived from public financial disclosures filed under the STOCK Act.
                Values represent estimated minimums of disclosed ranges, following methodology developed by
                GovTrades and NOTUS Capitol Gains. Data sourced from CapitolTrades.{" "}
                <a href="/networth" className="text-accent hover:underline">View full analysis</a> for detailed
                methodology, sector breakdowns, and per-member estimates.
              </p>
            </div>
          </div>
        );
      }

      case 'portfolios': {
        const sectorTotals = new Map<string, number>();
        enrichedTrades.forEach((t) => {
          if (t.sector && t.sector !== "Unknown") {
            sectorTotals.set(t.sector, (sectorTotals.get(t.sector) || 0) + t.estimated_value);
          }
        });
        const topSectors = Array.from(sectorTotals.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6);
        return (
          <div key={animKey}>
            <SectionHeader title="Sector Allocation" subtitle="Aggregate Holdings" actionLabel="View Net Worth" onAction={() => window.location.href = '/networth'} />
            {topSectors.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {topSectors.map(([sector, value]) => (
                  <div key={sector} className="p-6 bg-card border border-border rounded-sm shadow-sm text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{sector}</p>
                    <p className="font-serif text-xl font-bold text-primary">${(value / 1e6).toFixed(1)}M</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-16 text-center bg-card border border-border rounded-sm shadow-sm">
                <h3 className="font-serif text-3xl text-primary mb-4">Analysis Pending</h3>
                <p className="text-muted-foreground max-w-md mx-auto">Sector allocation analysis requires aggregating historical trade data. The enrichment API may not be available.</p>
              </div>
            )}
          </div>
        );
      }

      case 'anomaly': {
        const sorted = [...anomalyScores].sort((a, b) => b.overall_score - a.overall_score);
        return (
          <div key={animKey}>
            <SectionHeader title="Anomaly Detection" subtitle="Cross-API Signal Analysis" />
            {sorted.length > 0 ? (
              <div className="space-y-4">
                {sorted.map((score, i) => {
                  const topSignal = Object.entries(score.signals)
                    .map(([key, value]) => ({ key, value: value as number }))
                    .sort((a, b) => b.value - a.value)[0];
                  return (
                    <div
                      key={score.member_identifier}
                      className={`p-6 bg-card border border-border rounded-sm shadow-sm hover:shadow-md transition-shadow animate-stagger-item delay-${(i % 5) + 1}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-serif text-xl font-bold text-primary">{score.member_name}</h3>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Score: {score.overall_score.toFixed(2)}
                            {score.percentile !== null && (
                              <span className="ml-2">(P{score.percentile.toFixed(0)})</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="w-16 h-16 rounded-full border-4 border-accent flex items-center justify-center">
                            <span className="font-mono text-lg font-bold text-accent">{score.overall_score.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-border">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Signal Breakdown</p>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                          {Object.entries(score.signals).map(([key, value]) => (
                            <div
                              key={key}
                              className={`p-2 text-center rounded-sm text-xs ${
                                key === topSignal?.key
                                  ? 'bg-accent/10 border border-accent/30 text-accent font-semibold'
                                  : 'bg-muted/30 text-muted-foreground'
                              }`}
                            >
                              <div className="text-[9px] uppercase tracking-wider mb-0.5">
                                {key.replace(/_/g, ' ')}
                              </div>
                              <div className="font-mono font-bold">{(value as number).toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-16 text-center bg-card border border-border rounded-sm shadow-sm">
                <h3 className="font-serif text-3xl text-primary mb-4">Data Unavailable</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Anomaly detection requires cross-referencing data from Congress.gov, OpenFEC,
                  and lobbying disclosure APIs. Ensure all API keys are configured and data is
                  available for the current session.
                </p>
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen pb-20">

      {/* Main Container */}
      <main className="max-w-[1400px] mx-auto px-6 md:px-12 pt-12 md:pt-16">
        {renderContent()}
      </main>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 flex justify-between overflow-x-auto z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveTab('overview')} className="flex flex-col items-center gap-2 min-w-[60px] text-muted-foreground hover:text-primary transition-colors">
          <Grid size={20} />
          <span className="text-[10px] font-semibold uppercase tracking-wide">Home</span>
        </button>
        <button onClick={() => setActiveTab('legislators')} className="flex flex-col items-center gap-2 min-w-[60px] text-muted-foreground hover:text-primary transition-colors">
          <Users size={20} />
          <span className="text-[10px] font-semibold uppercase tracking-wide">PPL</span>
        </button>
        <button onClick={() => window.location.href = '/bills'} className="flex flex-col items-center gap-2 min-w-[60px] text-muted-foreground hover:text-primary transition-colors">
          <FileText size={20} />
          <span className="text-[10px] font-semibold uppercase tracking-wide">Bills</span>
        </button>
        <button onClick={() => setActiveTab('stocks')} className="flex flex-col items-center gap-2 min-w-[60px] text-muted-foreground hover:text-primary transition-colors">
          <TrendingUp size={20} />
          <span className="text-[10px] font-semibold uppercase tracking-wide">$</span>
        </button>
        <button onClick={() => setActiveTab('networth')} className="flex flex-col items-center gap-2 min-w-[60px] text-muted-foreground hover:text-primary transition-colors">
          <PieChart size={20} />
          <span className="text-[10px] font-semibold uppercase tracking-wide">Worth</span>
        </button>
        <button onClick={() => setActiveTab('anomaly')} className="flex flex-col items-center gap-2 min-w-[60px] text-muted-foreground hover:text-primary transition-colors">
          <BarChart3 size={20} />
          <span className="text-[10px] font-semibold uppercase tracking-wide">Risk</span>
        </button>
      </div>

    </div>
  );
}
