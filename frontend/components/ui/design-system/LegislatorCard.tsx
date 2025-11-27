import React from 'react';

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
    name,
    state,
    party,
    cash,
    risk,
    delay = "delay-1"
}) => (
    <div className={`p-8 bg-[#171717] border-2 border-white/10 hover-lift group cursor-pointer relative overflow-hidden animate-stagger-item ${delay}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 -mr-16 -mt-16 rounded-full blur-3xl group-hover:bg-[#ff4d00]/20 transition-all duration-700 ease-in-out"></div>

        <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="w-12 h-12 bg-white/10 flex items-center justify-center text-white font-serif font-black text-xl group-hover:bg-[#ff4d00] group-hover:text-black transition-all duration-300">
                {name.charAt(5)}
            </div>
            <span className={`font-mono text-xs font-bold px-3 py-1 ${risk === 'High' ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
                {risk} Activity
            </span>
        </div>

        <h3 className="font-serif text-2xl font-bold text-white mb-1 relative z-10 group-hover:translate-x-1 transition-transform duration-300">{name}</h3>
        <p className="font-mono text-xs font-bold text-gray-500 uppercase mb-6 relative z-10">{state} — {party}</p>

        <div className="pt-6 border-t-2 border-white/10 flex justify-between items-center relative z-10">
            <span className="font-mono text-xs font-bold text-gray-500">CASH ON HAND</span>
            <span className="font-mono text-lg font-bold text-white">{cash}</span>
        </div>
    </div>
);
