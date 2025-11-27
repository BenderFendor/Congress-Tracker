import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface SectionHeaderProps {
    title: string;
    subtitle: string;
    actionLabel?: string;
    onAction?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, actionLabel = "Export Report", onAction }) => (
    <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b-2 border-white/20 animate-stagger-item delay-1">
        <div>
            <h2 className="font-serif text-4xl font-black text-white tracking-tight mb-2 uppercase">{title}</h2>
            <p className="font-mono text-xs text-[#ff4d00] font-bold uppercase tracking-widest">{subtitle}</p>
        </div>
        <div className="mt-4 md:mt-0">
            <button
                onClick={onAction}
                className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-white hover:text-[#ff4d00] transition-colors border border-white/20 px-4 py-2 hover:border-[#ff4d00] hover:bg-white/5 transition-all duration-300"
            >
                {actionLabel} <ArrowUpRight size={14} />
            </button>
        </div>
    </div>
);
