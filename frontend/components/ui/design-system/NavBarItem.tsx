import React from 'react';

interface NavBarItemProps {
    active: boolean;
    label: string;
    onClick: () => void;
}

export const NavBarItem: React.FC<NavBarItemProps> = ({ active, label, onClick }) => (
    <button
        onClick={onClick}
        className={`px-6 py-4 font-mono text-sm uppercase tracking-wide transition-all duration-500 border-b-4 relative overflow-hidden group ${active
                ? 'border-accent text-foreground font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-white/50'
            }`}
    >
        <span className="relative z-10">{label}</span>
        {active && (
            <span className="absolute inset-0 bg-muted animate-scale-in origin-bottom" />
        )}
    </button>
);
