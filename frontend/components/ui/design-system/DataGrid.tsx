import React from 'react';

interface DataGridProps {
    headers: string[];
    children: React.ReactNode;
}

export const DataGrid: React.FC<DataGridProps> = ({ headers, children }) => (
    <div className="w-full bg-card border border-border rounded-sm shadow-sm animate-stagger-item delay-2 overflow-hidden">
        <div className="grid border-b border-border bg-background" style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}>
            {headers.map((h, i) => (
                <div key={i} className="p-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-r border-border last:border-r-0">
                    {h}
                </div>
            ))}
        </div>
        <div className="divide-y divide-gray-100 text-[13px] text-foreground">
            {children}
        </div>
    </div>
);
