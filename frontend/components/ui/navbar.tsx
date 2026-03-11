"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Shield } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

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
        <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border px-6 md:px-12 py-5 flex justify-between items-center transition-all duration-300">
            <div className="flex items-center gap-3 group cursor-default">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-sm transition-transform duration-500 ease-in-out group-hover:scale-105">
                    <Shield size={16} strokeWidth={2} />
                </div>
                <h1 className="font-serif text-2xl tracking-tight text-primary">
                    Congress<span className="italic text-accent">Tracker</span>
                </h1>
            </div>
            <nav className="hidden xl:flex items-center space-x-8">
                {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`text-[13px] font-medium tracking-wide transition-colors ${isActive(link.href) ? "text-accent" : "text-muted-foreground hover:text-primary"
                            }`}
                    >
                        {link.label}
                    </Link>
                ))}
                <ThemeToggle />
            </nav>
            {/* Mobile Menu Placeholder */}
            <div className="xl:hidden flex items-center gap-4">
                <ThemeToggle />
            </div>
        </header>
    )
}
