"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, Menu, Search, X } from "lucide-react"
import { useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exploreNavigationItems, navigationSections, primaryNavigationItems } from "@/lib/navigation"

export function Navbar() {
    const pathname = usePathname()
    const [menuOpen, setMenuOpen] = useState(false)

    const isActive = (path: string) => {
        if (path === "/" && pathname === "/") return true
        if (path !== "/" && pathname.startsWith(path)) return true
        return false
    }

    const exploreActive = exploreNavigationItems.some((item) => isActive(item.href))

    function openCommandPalette() {
        window.dispatchEvent(new Event("congress-tracker:open-command-palette"))
    }

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
                {primaryNavigationItems.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`civic-nav-link ${isActive(link.href) ? "active" : ""
                            }`}
                    >
                        {link.label}
                    </Link>
                ))}
                <DropdownMenu>
                    <DropdownMenuTrigger className={`civic-nav-link inline-flex items-center gap-1 ${exploreActive ? "active" : ""}`}>
                        Explore <ChevronDown size={13} aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="civic-explore-menu w-[22rem] p-2">
                        {navigationSections.map((section, sectionIndex) => {
                            const items = exploreNavigationItems.filter((item) => item.section === section)
                            if (items.length === 0) return null
                            return (
                                <div key={section}>
                                    {sectionIndex > 0 ? <DropdownMenuSeparator /> : null}
                                    <DropdownMenuLabel className="text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">{section}</DropdownMenuLabel>
                                    {items.map((item) => (
                                        <DropdownMenuItem key={item.href} asChild className="cursor-pointer items-start px-3 py-2.5">
                                            <Link href={item.href}>
                                                <span className="grid gap-0.5">
                                                    <strong className="text-xs font-semibold text-foreground">{item.label}</strong>
                                                    <span className="text-[0.68rem] leading-4 text-muted-foreground">{item.description}</span>
                                                </span>
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </div>
                            )
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
                <button type="button" onClick={openCommandPalette} className="civic-search" aria-label="Open record navigator" aria-keyshortcuts="Control+K Meta+K"><Search size={15} /></button>
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
                    {navigationSections.map((section) => (
                        <div className="civic-mobile-nav-section" key={section}>
                            <p>{section}</p>
                            {[...primaryNavigationItems, ...exploreNavigationItems]
                                .filter((item) => item.section === section)
                                .map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMenuOpen(false)}
                                        className={isActive(item.href) ? "active" : ""}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                        </div>
                    ))}
                </nav>
            ) : null}
        </header>
    )
}
