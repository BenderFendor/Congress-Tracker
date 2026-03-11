import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface SectionHeaderProps {
    title: string;
    subtitle: string;
    actionLabel?: string;
    onAction?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, actionLabel = "Export Report", onAction }) => (
    <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 pb-6 border-b border-border animate-stagger-item delay-1">
        <div>
            <p className="text-[11px] font-semibold text-accent uppercase tracking-wide mb-3">{subtitle}</p>
            <h2 className="font-serif text-4xl md:text-5xl text-primary tracking-tight">{title}</h2>
        </div>
        <div className="mt-6 md:mt-0">
            <button
                onClick={onAction}
                className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground hover:text-primary transition-colors pb-1 border-b border-transparent hover:border-[#0B1D3A] duration-300"
            >
                {actionLabel} <ArrowUpRight size={14} />
            </button>
        </div>
    </div>
);
