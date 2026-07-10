"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Shield, X } from "lucide-react"
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
        { href: "/stocks", label: "Stocks" },
        { href: "/portfolio", label: "Portfolio" },
        { href: "/lobbying", label: "Lobbying" },
        { href: "/elections", label: "Elections" },
        { href: "/search", label: "Search" },
    ]

    return (
        <header className="sticky top-0 z-50 border-b border-border/80 bg-card/78 px-5 py-4 shadow-[0_1px_30px_rgba(21,19,16,0.05)] backdrop-blur-xl transition-all duration-300 md:px-10">
            <div className="mx-auto flex w-full max-w-[116rem] items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
                <div className="grid h-10 w-10 place-items-center rounded-full border border-accent/35 bg-card text-primary shadow-sm transition-transform duration-500 ease-in-out group-hover:scale-105 dark:text-foreground">
                    <Shield size={17} strokeWidth={2} />
                </div>
                <h1 className="font-serif text-2xl tracking-tight text-primary dark:text-foreground">
                    Congress<span className="italic text-accent">Tracker</span>
                </h1>
            </Link>
            <nav className="hidden items-center gap-6 xl:flex">
                {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`relative py-2 text-[13px] font-medium tracking-wide transition-colors ${isActive(link.href) ? "text-accent after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-accent" : "text-muted-foreground hover:text-primary dark:hover:text-foreground"
                            }`}
                    >
                        {link.label}
                    </Link>
                ))}
                <ThemeToggle />
            </nav>
            <div className="xl:hidden flex items-center gap-2">
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
                <nav aria-label="Mobile navigation" className="mx-auto mt-4 grid w-full max-w-[116rem] grid-cols-2 gap-x-5 border-t border-border/70 pt-4 sm:grid-cols-3">
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
