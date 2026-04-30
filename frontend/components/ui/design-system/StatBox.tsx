import React from 'react';

interface StatBoxProps {
    label: string;
    value: string | number;
    trend?: string;
    trendColor?: string;
    delay?: string;
}

export const StatBox: React.FC<StatBoxProps> = ({
    label,
    value,
    trend,
    trendColor = "text-accent",
    delay = "delay-1"
}) => (
    <div
        className={`relative overflow-hidden p-6 bg-card border border-border rounded-sm shadow-sm hover-lift group animate-stagger-item ${delay} cursor-default`}
    >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors duration-500 pointer-events-none"></div>
        <div className="relative z-10 flex justify-between items-start mb-6">
            <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide group-hover:text-primary transition-colors duration-300">{label}</span>
            {trend && (
                <span className={`text-[11px] font-medium ${trendColor} bg-muted px-2 py-1 rounded-sm group-hover:bg-primary/5 transition-colors duration-300`}>
                    {trend}
                </span>
            )}
        </div>
        <div className="relative z-10 font-serif text-4xl md:text-5xl text-primary tracking-tight group-hover:scale-105 origin-left transition-transform duration-500">{value}</div>
    </div>
);
