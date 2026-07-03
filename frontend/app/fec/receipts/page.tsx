"use client"

import { useState, useEffect } from "react"
import { Search, Calendar, DollarSign, User, Filter } from "lucide-react"
import { getAllReceipts, FECReceipt } from "@/lib/services/fec"
import { useSearchParams } from "next/navigation"

export default function ReceiptsPage() {
    const searchParams = useSearchParams();
    const committeeId = searchParams.get("committee");

    const [receipts, setReceipts] = useState<FECReceipt[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [filterCommittee, setFilterCommittee] = useState(committeeId || "all")

    useEffect(() => {
        async function loadReceipts() {
            try {
                const data = await getAllReceipts(committeeId || undefined);
                setReceipts(data);
            } catch (error) {
                console.error("Failed to load receipts", error);
            } finally {
                setLoading(false);
            }
        }
        loadReceipts();
    }, [committeeId]);

    // Filter receipts
    const filteredReceipts = receipts.filter(receipt => {
        const matchesSearch = !searchTerm ||
            receipt.contributor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            receipt.committee_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCommittee = filterCommittee === "all" || receipt.committee_id === filterCommittee;

        return matchesSearch && matchesCommittee;
    });

    // Get unique committees
    const committees = [...new Set(receipts.map(r => r.committee_id))].sort();

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent text-accent-foreground selection:text-foreground pb-20">
            <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">
                {/* Header */}
                <div className="mb-12">
                    <h2 className="font-serif text-5xl md:text-6xl font-bold text-foreground mb-4 leading-none tracking-tight">
                        CAMPAIGN <span className="text-accent">RECEIPTS</span>
                    </h2>
                    <p className="font-mono text-muted-foreground max-w-xl text-sm uppercase tracking-wide">
                        Track campaign contributions and donor information from federal election filings.
                    </p>
                </div>

                {/* Search and Filters */}
                <div className="mb-12 animate-stagger-item delay-1">
                    <div className="flex flex-col lg:flex-row gap-6 mb-8">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-accent" size={20} />
                            <input
                                type="text"
                                placeholder="SEARCH BY DONOR OR COMMITTEE..."
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <select
                            value={filterCommittee}
                            onChange={(e) => setFilterCommittee(e.target.value)}
                            className="bg-card border-2 border-border px-4 py-3 text-foreground font-mono text-sm uppercase focus:border-accent outline-none appearance-none"
                        >
                            <option value="all">All Committees</option>
                            {committees.map(committee => (
                                <option key={committee} value={committee}>{committee}</option>
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
                    Showing {filteredReceipts.length} of {receipts.length} receipts
                </div>

                {/* Receipts Table */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="bg-card border-2 border-border overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 p-4 bg-muted border-b border-border font-mono text-[10px] font-bold uppercase text-muted-foreground tracking-wide">
                            <div className="col-span-3">Donor</div>
                            <div className="col-span-3">Committee</div>
                            <div className="col-span-2">Date</div>
                            <div className="col-span-2">Amount</div>
                            <div className="col-span-2 text-right">Employer</div>
                        </div>

                        {/* Table Rows */}
                        <div className="divide-y divide-border">
                            {filteredReceipts.map((receipt, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-4 p-4 hover:bg-muted/50 transition-colors group">
                                    <div className="col-span-3 flex items-center gap-3">
                                        <div className="w-8 h-8 bg-muted border border-border flex items-center justify-center text-muted-foreground">
                                            <User size={14} />
                                        </div>
                                        <div>
                                            <div className="font-sans text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate max-w-[200px]">
                                                {receipt.contributor_name}
                                            </div>
                                            {receipt.occupation && (
                                                <div className="text-[10px] font-mono text-muted-foreground uppercase">
                                                    {receipt.occupation}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="col-span-3">
                                        <div className="font-mono text-xs text-foreground truncate" title={receipt.committee_name}>
                                            {receipt.committee_name}
                                        </div>
                                        <div className="text-[10px] font-mono text-muted-foreground uppercase mt-0.5">
                                            {receipt.committee_id}
                                        </div>
                                    </div>

                                    <div className="col-span-2 flex items-center gap-2 text-xs font-mono text-muted-foreground">
                                        <Calendar size={12} />
                                        {receipt.contribution_date}
                                    </div>

                                    <div className="col-span-2 flex items-center gap-1 font-mono text-sm font-bold text-foreground">
                                        <DollarSign size={12} className="text-accent" />
                                        {receipt.amount.toLocaleString()}
                                    </div>

                                    <div className="col-span-2 flex items-center justify-end">
                                        <div className="text-[10px] font-mono text-muted-foreground uppercase truncate max-w-[100px]">
                                            {receipt.employer || "N/A"}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {filteredReceipts.length === 0 && !loading && (
                    <div className="text-center py-12 text-muted-foreground font-mono">
                        No receipts found matching your criteria.
                    </div>
                )}
            </div>
        </div>
    );
}
