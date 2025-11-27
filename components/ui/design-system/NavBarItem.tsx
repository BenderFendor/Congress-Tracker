import React from 'react';

interface NavBarItemProps {
    active: boolean;
    label: string;
    onClick: () => void;
}

export const NavBarItem: React.FC<NavBarItemProps> = ({ active, label, onClick }) => (
    <button
        onClick={onClick}
        className={`px-6 py-4 font-mono text-sm uppercase tracking-widest transition-all duration-500 border-b-4 relative overflow-hidden group ${active
                ? 'border-[#ff4d00] text-white font-black'
                : 'border-transparent text-gray-500 hover:text-white hover:border-white/50'
            }`}
    >
        <span className="relative z-10">{label}</span>
        {active && (
            <span className="absolute inset-0 bg-white/5 animate-scale-in origin-bottom" />
        )}
    </button>
);
