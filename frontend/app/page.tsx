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

export default function CongressTracker() {
  const [activeTab, setActiveTab] = useState('overview');
  const [animKey, setAnimKey] = useState(0);

  // State for real data
  const [legislators, setLegislators] = useState<Legislator[]>([]);
  const [trades, setTrades] = useState<StockTrade[]>([]);
  const [filings, setFilings] = useState<Filing[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAnimKey(prev => prev + 1);
  }, [activeTab]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [legislatorsData, tradesData, filingsData, billsData] = await Promise.all([
          getAllLegislators('house', 118),
          getRecentTrades(10),
          getRecentFilings(1, 5),
          getRecentBills(5)
        ]);

        setLegislators(legislatorsData.slice(0, 6)); // Limit for display
        setTrades(tradesData);
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
    ...trades.slice(0, 1).map(t => ({ id: 'TRADING', text: `${t.representative} ${t.type} ${t.ticker} (${t.amount})`, date: t.transaction_date })),
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
          <div className="w-12 h-12 border-4 border-[#ff4d00] border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div key={animKey} className="pb-12">
            <div className="mb-16 max-w-4xl border-l-4 border-[#ff4d00] pl-8 animate-stagger-item delay-1">
              <h1 className="font-serif text-5xl md:text-7xl font-black leading-none mb-6 text-white tracking-tighter">
                PUBLIC <br />
                <span className="text-gray-500">TRANSPARENCY</span>
              </h1>
              <p className="font-mono text-lg font-bold text-gray-400 leading-relaxed max-w-2xl">
                Real-time monitoring of federal legislative activity, financial disclosures, and lobbying records.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              <StatBox label="Active Members" value="535" delay="delay-1" />
              <StatBox label="Recent Bills" value={bills.length > 0 ? "15K+" : "Loading..."} trend="Active Session" delay="delay-2" />
              <StatBox label="Lobbying Reports" value={filings.length > 0 ? "20K+" : "Loading..."} trend="Q3 2024" trendColor="text-[#ff4d00]" delay="delay-3" />
              <StatBox label="Recent Trades" value={trades.length > 0 ? "10K+" : "Loading..."} trend="High Activity" trendColor="text-[#ff4d00]" delay="delay-4" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 border-t-2 border-white/20 pt-8 animate-stagger-item delay-5">
              <Briefing items={displayBriefing} />

              <div className="bg-[#171717] p-8 border-2 border-white/10 hover:border-white/30 transition-colors duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <Info className="text-[#ff4d00]" size={24} />
                  <h3 className="font-mono text-sm font-black uppercase text-white">Data Sources</h3>
                </div>

                <div className="space-y-6 font-serif text-gray-300 leading-relaxed">
                  <p>
                    <strong>Legislators & Bills:</strong> Congress.gov API
                  </p>
                  <p>
                    <strong>Lobbying:</strong> Senate LDA API
                  </p>
                  <p>
                    <strong>Financials:</strong> STOCK Act Disclosures (Mock/ProPublica)
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-white/10">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar size={14} />
                    <span className="font-mono text-xs font-bold uppercase">Last Updated: {new Date().toLocaleDateString()}</span>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {legislators.map((l, i) => (
                <LegislatorCard
                  key={l.id}
                  id={l.id}
                  name={l.name}
                  state={l.state}
                  party={l.party}
                  age={0} // Not available in basic API
                  cash="N/A" // Not available in basic API
                  risk="Med" // Placeholder
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
                <div key={i} className={`grid grid-cols-6 hover:bg-white/5 transition-colors items-center group animate-stagger-item delay-${(i % 5) + 1}`}>
                  <div className="p-4 border-r-2 border-white/10 font-black text-[#ff4d00] group-hover:translate-x-1 transition-transform">{t.ticker}</div>
                  <div className="p-4 border-r-2 border-white/10 text-white font-bold truncate">{t.asset_description}</div>
                  <div className={`p-4 border-r-2 border-white/10 font-black ${t.type.includes('sale') ? 'text-red-500' : 'text-green-500'}`}>{t.type.toUpperCase()}</div>
                  <div className="p-4 border-r-2 border-white/10 text-white font-bold">{t.amount}</div>
                  <div className="p-4 border-r-2 border-white/10 text-gray-500 font-bold">{t.transaction_date}</div>
                  <div className="p-4 font-serif font-bold text-white group-hover:underline decoration-[#ff4d00] underline-offset-4">{t.representative}</div>
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
                <div key={i} className={`grid grid-cols-4 hover:bg-white/5 transition-colors items-center group animate-stagger-item delay-${(i % 5) + 1}`}>
                  <div className="p-4 border-r-2 border-white/10 font-black text-[#ff4d00]">{b.id}</div>
                  <div className="p-4 border-r-2 border-white/10 text-white font-bold">{b.title}</div>
                  <div className="p-4 border-r-2 border-white/10 text-white font-bold">{b.status}</div>
                  <div className="p-4 text-gray-500 font-bold">{b.date}</div>
                </div>
              ))}
            </DataGrid>
          </div>
        );

      case 'networth':
        // Placeholder as we don't have a real net worth API yet
        return (
          <div key={animKey}>
            <SectionHeader title="Wealth Analysis" subtitle="Net Worth Estimates" />
            <div className="p-12 text-center border-2 border-white/10 bg-[#171717]">
              <h3 className="text-2xl font-bold text-white mb-4">Data Unavailable</h3>
              <p className="text-gray-400">Real-time net worth data requires a premium API subscription.</p>
            </div>
          </div>
        );

      case 'portfolios':
        // Placeholder
        return (
          <div key={animKey}>
            <SectionHeader title="Sector Allocation" subtitle="Aggregate Holdings" />
            <div className="p-12 text-center border-2 border-white/10 bg-[#171717]">
              <h3 className="text-2xl font-bold text-white mb-4">Analysis Pending</h3>
              <p className="text-gray-400">Sector allocation analysis requires aggregating all trade data.</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#ff4d00] selection:text-white pb-20">



      {/* Main Container */}
      <main className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12 md:pt-16">
        {renderContent()}
      </main>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#171717] border-t-2 border-white/10 p-4 flex justify-between overflow-x-auto z-50">
        <button onClick={() => setActiveTab('overview')} className="flex flex-col items-center gap-2 min-w-[60px] text-gray-400 hover:text-[#ff4d00]">
          <Grid size={20} />
          <span className="text-[10px] font-mono font-black uppercase">Home</span>
        </button>
        <button onClick={() => setActiveTab('legislators')} className="flex flex-col items-center gap-2 min-w-[60px] text-gray-400 hover:text-[#ff4d00]">
          <Users size={20} />
          <span className="text-[10px] font-mono font-black uppercase">PPL</span>
        </button>
        <button onClick={() => window.location.href = '/bills'} className="flex flex-col items-center gap-2 min-w-[60px] text-gray-400 hover:text-[#ff4d00]">
          <FileText size={20} />
          <span className="text-[10px] font-mono font-black uppercase">Bills</span>
        </button>
        <button onClick={() => setActiveTab('stocks')} className="flex flex-col items-center gap-2 min-w-[60px] text-gray-400 hover:text-[#ff4d00]">
          <TrendingUp size={20} />
          <span className="text-[10px] font-mono font-black uppercase">$</span>
        </button>
        <button onClick={() => setActiveTab('networth')} className="flex flex-col items-center gap-2 min-w-[60px] text-gray-400 hover:text-[#ff4d00]">
          <PieChart size={20} />
          <span className="text-[10px] font-mono font-black uppercase">Worth</span>
        </button>
      </div>

    </div>
  );
}
