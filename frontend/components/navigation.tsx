"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "./theme-toggle"
import { Button } from "@/components/ui/button"
import { BarChart3, Users, FileText, Building2, TrendingUp, DollarSign, PieChart, Menu, X } from "lucide-react"
import { useState } from "react"

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Legislators", href: "/legislators", icon: Users },
  { name: "Bills", href: "/bills", icon: FileText },
  { name: "Lobbying", href: "/lobbying", icon: Building2 },
  { name: "Stocks", href: "/stocks", icon: TrendingUp },
  { name: "Net Worth", href: "/networth", icon: DollarSign },
  { name: "Portfolio", href: "/portfolio", icon: PieChart },
]

export function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group transition-all duration-300 hover:scale-105">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center group-hover:shadow-lg transition-all duration-300">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-primary">Congress Tracker</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={`
                      relative transition-all duration-300 hover:scale-105
                      ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg font-medium"
                          : "hover:bg-accent/20 text-foreground hover:text-foreground"
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.name}
                    {isActive && <div className="absolute inset-0 bg-primary/10 rounded-md animate-pulse" />}
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* Theme Toggle & Mobile Menu */}
          <div className="flex items-center space-x-2">
            <ThemeToggle />

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-9 w-9 px-0 hover:bg-accent/10 transition-all duration-300"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link key={item.name} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={`
                        w-full justify-start transition-all duration-300 font-medium
                        ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent/20 text-foreground hover:text-foreground"
                        }
                      `}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Button>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
