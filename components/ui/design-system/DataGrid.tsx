import React from 'react';

interface DataGridProps {
    headers: string[];
    children: React.ReactNode;
}

export const DataGrid: React.FC<DataGridProps> = ({ headers, children }) => (
    <div className="w-full bg-[#171717] border-2 border-white/10 animate-stagger-item delay-2">
        <div className="grid border-b-2 border-white/10 bg-white/5" style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}>
            {headers.map((h, i) => (
                <div key={i} className="p-4 font-mono text-xs font-black uppercase tracking-wider text-gray-400 border-r-2 border-white/10 last:border-r-0">
                    {h}
                </div>
            ))}
        </div>
        <div className="divide-y-2 divide-white/10 font-mono text-sm text-white font-bold">
            {children}
        </div>
    </div>
);
