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
        className={`p-6 bg-card border border-border rounded-sm shadow-sm hover-lift group animate-stagger-item ${delay} cursor-default`}
    >
        <div className="flex justify-between items-start mb-6">
            <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide group-hover:text-primary transition-colors duration-300">{label}</span>
            {trend && (
                <span className={`text-[11px] font-medium ${trendColor} bg-muted px-2 py-1 rounded-sm`}>
                    {trend}
                </span>
            )}
        </div>
        <div className="font-serif text-4xl md:text-5xl text-primary tracking-tight">{value}</div>
    </div>
);
