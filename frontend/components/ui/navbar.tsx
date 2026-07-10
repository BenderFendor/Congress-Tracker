"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Search, X } from "lucide-react"
import { useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"

export function Navbar() {
    const pathname = usePathname()
    const [menuOpen, setMenuOpen] = useState(false)

    const isActive = (path: string) => {
        if (path === "/" && pathname === "/") return true
        if (path !== "/" && pathname.startsWith(path)) return true
        return false
    }

    const navLinks = [
        { href: "/", label: "Home" },
        { href: "/legislators", label: "Legislators" },
        { href: "/bills", label: "Bills" },
        { href: "/influence", label: "Influence" },
        { href: "/committees", label: "Committees" },
        { href: "/portfolio", label: "Portfolio" },
        { href: "/lobbying", label: "Lobbying" },
        { href: "/elections", label: "Elections" },
        { href: "/search", label: "Search" },
    ]

    return (
        <header className="civic-header">
            <div className="civic-header-inner">
            <Link href="/" className="civic-brand group" aria-label="CongressTracker home">
                <svg className="civic-seal" viewBox="0 0 44 44" aria-hidden="true">
                    <circle cx="22" cy="22" r="20" />
                    <path d="M13 28h18M15 25h14M17 25v-8m4 8v-8m6 8v-8M15 17h14l-7-5-7 5Z" />
                    <path className="civic-seal-orbit" d="M7 22a15 15 0 0 0 30 0" />
                </svg>
                <span className="font-serif text-2xl tracking-tight text-primary dark:text-foreground">
                    Congress<span className="italic text-accent">Tracker</span>
                </span>
            </Link>
            <nav aria-label="Primary navigation" className="civic-nav hidden xl:flex">
                {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`civic-nav-link ${isActive(link.href) ? "active" : ""
                            }`}
                    >
                        {link.label}
                    </Link>
                ))}
                <Link href="/search" className="civic-search" aria-label="Search records"><Search size={15} /></Link>
                <ThemeToggle />
            </nav>
            <div className="flex items-center gap-2 xl:hidden">
                <ThemeToggle />
                <button
                    type="button"
                    aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-primary transition hover:border-accent hover:text-accent dark:text-foreground"
                >
                    {menuOpen ? <X size={17} /> : <Menu size={17} />}
                </button>
            </div>
            </div>
            {menuOpen ? (
                <nav aria-label="Mobile navigation" className="civic-mobile-nav">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMenuOpen(false)}
                            className={`border-b border-border/60 py-3 text-sm font-medium ${isActive(link.href) ? "text-accent" : "text-muted-foreground hover:text-primary dark:hover:text-foreground"}`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
            ) : null}
        </header>
    )
}
