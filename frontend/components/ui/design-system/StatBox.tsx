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
    trendColor = "text-green-500",
    delay = "delay-1"
}) => (
    <div
        className={`p-6 bg-[#171717] border-2 border-white/10 hover-lift group animate-stagger-item ${delay} cursor-default`}
    >
        <div className="flex justify-between items-start mb-4">
            <span className="font-mono text-xs text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors duration-300">{label}</span>
            {trend && (
                <span className={`text-xs font-mono font-bold ${trendColor} bg-white/5 px-2 py-1 rounded-sm`}>
                    {trend}
                </span>
            )}
        </div>
        <div className="font-serif text-4xl md:text-5xl font-black text-white tracking-tight">{value}</div>
    </div>
);
