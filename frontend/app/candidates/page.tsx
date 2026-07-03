"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, MapPin, Users, Filter, ExternalLink, Building } from "lucide-react"
import { getAllCandidates, FECandidate, getCommittees, FECCommittee } from "@/lib/services/fec"

export default function CandidatesPage() {
    const [candidates, setCandidates] = useState<FECandidate[]>([])
    const [committees, setCommittees] = useState<FECCommittee[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedState, setSelectedState] = useState("all")
    const [selectedOffice, setSelectedOffice] = useState("all")
    const [committeeSearch, setCommitteeSearch] = useState("")
    const [activeTab, setActiveTab] = useState<"candidates" | "committees">("candidates")

    useEffect(() => {
        async function loadData() {
            try {
                const [candidatesData, committeesData] = await Promise.all([
                    getAllCandidates(),
                    getCommittees()
                ]);
                setCandidates(candidatesData);
                setCommittees(committeesData);
            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Filter candidates
    const filteredCandidates = candidates.filter(candidate => {
        const matchesSearch = !searchTerm ||
            candidate.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            candidate.candidate_id?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesState = selectedState === "all" || candidate.state === selectedState;
        const matchesOffice = selectedOffice === "all" || candidate.office_sought === selectedOffice;

        return matchesSearch && matchesState && matchesOffice;
    });

    // Filter committees
    const filteredCommittees = committees
        .filter(c => !committeeSearch ||
            c.committee_name?.toLowerCase().includes(committeeSearch.toLowerCase()) ||
            c.committee_id?.toLowerCase().includes(committeeSearch.toLowerCase()))
        .sort((a, b) => (a.committee_name || "").localeCompare(b.committee_name || ""));

    // Get unique states and offices
    const states = [...new Set(candidates.map(c => c.state).filter(Boolean))].sort();
    const offices = [...new Set(candidates.map(c => c.office_sought).filter(Boolean))].sort();

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent text-accent-foreground selection:text-foreground pb-20">
            <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">
                {/* Header */}
                <div className="mb-12">
                    <h2 className="font-serif text-5xl md:text-6xl font-bold text-foreground mb-4 leading-none tracking-tight">
                        CANDIDATES <span className="text-accent">DIRECTORY</span>
                    </h2>
                    <p className="font-mono text-muted-foreground max-w-xl text-sm uppercase tracking-wide">
                        Track federal election candidates and their campaign finance data.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-0 mb-12 border-b-2 border-border">
                    <button
                        onClick={() => setActiveTab("candidates")}
                        className={`px-8 py-3 font-mono font-bold text-sm uppercase transition-all border-b-2 -mb-[2px] ${
                            activeTab === "candidates"
                                ? "border-accent text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Candidates
                    </button>
                    <button
                        onClick={() => setActiveTab("committees")}
                        className={`px-8 py-3 font-mono font-bold text-sm uppercase transition-all border-b-2 -mb-[2px] ${
                            activeTab === "committees"
                                ? "border-accent text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        PAC Committees
                    </button>
                </div>

                {activeTab === "candidates" && (
                <>
                {/* Search and Filters */}
                <div className="mb-12 animate-stagger-item delay-1">
                    <div className="flex flex-col lg:flex-row gap-6 mb-8">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-accent" size={20} />
                            <input
                                type="text"
                                placeholder="SEARCH BY NAME OR ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-card border-2 border-border px-12 py-4 text-foreground font-mono font-bold placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-all uppercase tracking-wider"
                            />
                        </div>
                        <button className="flex items-center justify-center gap-2 bg-muted border-2 border-border px-8 py-4 font-mono font-bold uppercase hover:bg-muted/50 hover:border-accent transition-all text-accent">
                            <Filter size={16} />
                            Advanced Filters
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <select
                            value={selectedState}
                            onChange={(e) => setSelectedState(e.target.value)}
                            className="bg-card border-2 border-border px-4 py-3 text-foreground font-mono text-sm uppercase focus:border-accent outline-none appearance-none"
                        >
                            <option value="all">All States</option>
                            {states.map(state => (
                                <option key={state} value={state}>{state}</option>
                            ))}
                        </select>

                        <select
                            value={selectedOffice}
                            onChange={(e) => setSelectedOffice(e.target.value)}
                            className="bg-card border-2 border-border px-4 py-3 text-foreground font-mono text-sm uppercase focus:border-accent outline-none appearance-none"
                        >
                            <option value="all">All Offices</option>
                            {offices.map(office => (
                                <option key={office} value={office}>{office}</option>
                            ))}
                        </select>

                        <button className="bg-accent text-accent-foreground text-black font-mono font-bold uppercase hover:bg-card hover:text-black transition-all px-4 py-3">
                            Apply Filters
                        </button>
                    </div>
                </div>

                {/* Results Summary */}
                <div className="mb-6 flex items-center gap-2 text-muted-foreground font-sans text-xs text-muted-foreground tracking-wide">
                    <div className="w-2 h-2 bg-accent text-accent-foreground rounded-full animate-pulse"></div>
                    Showing {filteredCandidates.length} of {candidates.length} candidates
                </div>

                {/* Candidates Grid */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredCandidates.map((candidate, idx) => (
                            <div key={candidate.candidate_id} className={`bg-card border-2 border-border p-6 hover:border-accent/50 transition-all duration-300 group animate-stagger-item delay-${(idx % 5) + 1}`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 bg-muted border border-border flex items-center justify-center text-muted-foreground">
                                        <Users size={20} />
                                    </div>
                                    {candidate.incumbent && (
                                        <div className="px-2 py-1 bg-yellow-900/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-mono font-bold uppercase">
                                            Incumbent
                                        </div>
                                    )}
                                </div>

                                <h3 className="font-serif text-xl font-bold text-foreground mb-2 group-hover:text-accent transition-colors">
                                    {candidate.name}
                                </h3>

                                <div className="space-y-2 mb-4">
                                    {candidate.office_sought && (
                                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase">
                                            <Building size={12} />
                                            {candidate.office_sought}
                                        </div>
                                    )}
                                    {candidate.state && (
                                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase">
                                            <MapPin size={12} />
                                            {candidate.state}{candidate.district ? `-${candidate.district}` : ""}
                                        </div>
                                    )}
                                    {candidate.party && (
                                        <div className="flex items-center gap-2 text-xs font-mono uppercase">
                                            <span className={`w-2 h-2 rounded-full ${candidate.party.includes("Democrat") ? "bg-blue-400" : candidate.party.includes("Republican") ? "bg-red-400" : "bg-gray-400"}`}></span>
                                            {candidate.party}
                                        </div>
                                    )}
                                </div>

                                {candidate.committee_name && (
                                    <div className="pt-4 border-t border-border">
                                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Affiliated Committee</div>
                                        <div className="text-sm font-sans text-foreground truncate">
                                            {candidate.committee_name}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                                    <Link
                                        href={`/fec/receipts?committee=${encodeURIComponent(candidate.committee_id || "")}`}
                                        className="text-[10px] font-mono text-accent hover:underline uppercase flex items-center gap-1"
                                    >
                                        View Receipts <ExternalLink size={10} />
                                    </Link>
                                    <div className="text-[10px] font-mono text-muted-foreground uppercase">
                                        ID: {candidate.candidate_id}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {filteredCandidates.length === 0 && !loading && (
                    <div className="text-center py-12 text-muted-foreground font-mono">
                        No candidates found matching your criteria.
                    </div>
                )}
                </>
                )}

                {activeTab === "committees" && (
                <>
                {/* Committees Search */}
                <div className="mb-12">
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-accent" size={20} />
                            <input
                                type="text"
                                placeholder="SEARCH COMMITTEES BY NAME OR ID..."
                                value={committeeSearch}
                                onChange={(e) => setCommitteeSearch(e.target.value)}
                                className="w-full bg-card border-2 border-border px-12 py-4 text-foreground font-mono font-bold placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-all uppercase tracking-wider"
                            />
                        </div>
                    </div>
                </div>

                {/* Committees Summary */}
                <div className="mb-6 flex items-center gap-2 text-muted-foreground font-sans text-xs tracking-wide">
                    <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                    Showing {filteredCommittees.length} of {committees.length} committees
                </div>

                {/* Committees Grid */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredCommittees.map((committee, idx) => (
                            <div key={committee.committee_id} className={`bg-card border-2 border-border p-6 hover:border-accent/50 transition-all duration-300 group animate-stagger-item delay-${(idx % 5) + 1}`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 bg-muted border border-border flex items-center justify-center text-muted-foreground">
                                        <Building size={20} />
                                    </div>
                                </div>

                                <h3 className="font-serif text-lg font-bold text-foreground mb-2 group-hover:text-accent transition-colors line-clamp-2">
                                    {committee.committee_name}
                                </h3>

                                <div className="space-y-2 mb-4">
                                    {committee.committee_type && (
                                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase">
                                            <Filter size={12} />
                                            {committee.committee_type}
                                        </div>
                                    )}
                                    {committee.state && (
                                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase">
                                            <MapPin size={12} />
                                            {committee.state}
                                        </div>
                                    )}
                                    {committee.party && (
                                        <div className="flex items-center gap-2 text-xs font-mono uppercase">
                                            <span className={`w-2 h-2 rounded-full ${committee.party.includes("Democrat") ? "bg-blue-400" : committee.party.includes("Republican") ? "bg-red-400" : "bg-gray-400"}`}></span>
                                            {committee.party}
                                        </div>
                                    )}
                                </div>

                                {committee.designation && (
                                    <div className="pt-4 border-t border-border">
                                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Designation</div>
                                        <div className="text-sm font-sans text-foreground">
                                            {committee.designation}
                                        </div>
                                    </div>
                                )}

                                {committee.organization_type && (
                                    <div className="pt-3">
                                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Organization Type</div>
                                        <div className="text-sm font-sans text-foreground">
                                            {committee.organization_type}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                                    <Link
                                        href={`/fec/receipts?committee=${encodeURIComponent(committee.committee_id)}`}
                                        className="text-[10px] font-mono text-accent hover:underline uppercase flex items-center gap-1"
                                    >
                                        View Receipts <ExternalLink size={10} />
                                    </Link>
                                    <div className="text-[10px] font-mono text-muted-foreground uppercase">
                                        ID: {committee.committee_id}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {filteredCommittees.length === 0 && !loading && (
                    <div className="text-center py-12 text-muted-foreground font-mono">
                        No committees found matching your criteria.
                    </div>
                )}
                </>
                )}
            </div>
        </div>
    );
}
