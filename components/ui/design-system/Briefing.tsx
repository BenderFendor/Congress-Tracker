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
        <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 bg-[#ff4d00] rounded-full animate-[pulse-slow_2s_infinite]" />
            <h3 className="font-mono text-sm font-black uppercase text-[#ff4d00]">Legislative Briefing</h3>
        </div>

        <ul className="space-y-6">
            {items.map((item, i) => (
                <li key={i} className={`flex gap-6 items-start group cursor-pointer border-b border-white/10 pb-6 last:border-0 hover-lift p-4 -mx-4 rounded-lg animate-stagger-item delay-${i + 2}`}>
                    <span className="font-mono text-sm font-bold text-gray-600 group-hover:text-[#ff4d00] transition-colors whitespace-nowrap pt-1">{item.id}</span>
                    <div className="flex-1">
                        <p className="font-serif text-xl font-bold text-white leading-tight group-hover:text-[#ff4d00] transition-colors duration-300">{item.text}</p>
                        <span className="font-mono text-xs text-gray-500 mt-2 block">{item.date}</span>
                    </div>
                </li>
            ))}
        </ul>
    </div>
);
