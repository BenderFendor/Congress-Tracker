import React from 'react';
import Link from 'next/link';

interface LegislatorProps {
    id: string;
    name: string;
    state: string;
    party: string;
    age: number;
    cash: string;
    risk: string;
    delay?: string;
}

export const LegislatorCard: React.FC<LegislatorProps> = ({
    id,
    name,
    state,
    party,
    cash,
    risk,
    delay = "delay-1"
}) => (
    <Link href={`/legislators/${id}`} className={`block p-8 bg-card border border-border rounded-sm shadow-sm hover-lift group cursor-pointer relative overflow-hidden animate-stagger-item ${delay}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary text-primary-foreground/5 -mr-16 -mt-16 rounded-full blur-3xl group-hover:bg-primary text-primary-foreground/10 transition-all duration-700 ease-in-out"></div>

        <div className="flex justify-between items-start mb-8 relative z-10">
            <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center text-primary font-serif text-xl group-hover:bg-primary text-primary-foreground group-hover:text-foreground transition-all duration-500">
                {name.charAt(0)}
            </div>
            <span className={`text-[10px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider ${risk === 'High' ? 'bg-[#FCA5A5]/20 text-accent' : 'bg-[#D1FAE5]/50 text-[#065F46]'}`}>
                {risk} Activity
            </span>
        </div>

        <h3 className="font-serif text-2xl text-primary mb-2 relative z-10 transition-transform duration-500">{name}</h3>
        <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide mb-8 relative z-10">{state} — {party}</p>

        <div className="pt-6 border-t border-border flex justify-between items-center relative z-10">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">CASH ON HAND</span>
            <span className="text-lg font-serif text-primary">{cash}</span>
        </div>
    </Link>
);
