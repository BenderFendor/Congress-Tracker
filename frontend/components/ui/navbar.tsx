"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Shield } from "lucide-react"

export function Navbar() {
    const pathname = usePathname()

    const isActive = (path: string) => {
        if (path === "/" && pathname === "/") return true
        if (path !== "/" && pathname.startsWith(path)) return true
        return false
    }

    const navLinks = [
        { href: "/", label: "Home" },
        { href: "/legislators", label: "Legislators" },
        { href: "/bills", label: "Bills" },
        { href: "/stocks", label: "Stocks" },
        { href: "/portfolio", label: "Portfolio" },
        { href: "/lobbying", label: "Lobbying" },
        { href: "/visualizations", label: "Visualizations" },
    ]

    return (
        <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b-2 border-white/10 px-6 md:px-12 py-4 flex justify-between items-center transition-all duration-300">
            <div className="flex items-center gap-4 group cursor-default">
                <div className="w-10 h-10 bg-[#ff4d00] flex items-center justify-center text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] group-hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] group-hover:translate-x-[2px] group-hover:translate-y-[2px] transition-all duration-300">
                    <Shield size={20} strokeWidth={3} />
                </div>
                <h1 className="font-serif text-2xl font-black tracking-tighter text-white">
                    CONGRESS<span className="font-light italic ml-1 text-gray-500">TRACKER</span>
                </h1>
            </div>
            <nav className="hidden xl:flex space-x-6">
                {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`font-mono text-sm font-bold uppercase tracking-widest transition-colors ${isActive(link.href) ? "text-[#ff4d00]" : "text-gray-400 hover:text-[#ff4d00]"
                            }`}
                    >
                        {link.label}
                    </Link>
                ))}
            </nav>
            {/* Mobile Menu Placeholder - For future implementation */}
            <div className="xl:hidden">
                {/* Add mobile menu toggle here if needed */}
            </div>
        </header>
    )
}
