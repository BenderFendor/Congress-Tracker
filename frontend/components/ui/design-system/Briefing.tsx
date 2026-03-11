import React from 'react';

interface BriefingItem {
    id: string;
    text: string;
    date: string;
}

interface BriefingProps {
    items: BriefingItem[];
}

export const Briefing: React.FC<BriefingProps> = ({ items }) => (
    <div className="lg:col-span-2">
        <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-2 bg-accent text-accent-foreground rounded-full animate-[pulse-slow_2s_infinite]" />
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-accent">Legislative Briefing</h3>
        </div>

        <ul className="space-y-6">
            {items.map((item, i) => (
                <li key={i} className={`flex gap-6 items-start group cursor-pointer border-b border-border pb-6 last:border-0 hover-lift p-4 -mx-4 rounded-lg animate-stagger-item delay-${i + 2}`}>
                    <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-accent transition-colors whitespace-nowrap pt-2 uppercase tracking-wide">{item.id}</span>
                    <div className="flex-1">
                        <p className="font-serif text-2xl text-primary leading-snug group-hover:text-accent transition-colors duration-300">{item.text}</p>
                        <span className="text-[12px] text-muted-foreground mt-3 block">{item.date}</span>
                    </div>
                </li>
            ))}
        </ul>
    </div>
);
