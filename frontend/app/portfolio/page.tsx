"use client"

import { HardHat } from "lucide-react"

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent selection:text-accent-foreground pb-20">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">
        <div className="mb-12">
          <h2 className="font-serif text-5xl md:text-6xl font-bold text-foreground mb-4 leading-none tracking-tight">
            YOUR <span className="text-accent">ASSETS</span>
          </h2>
          <p className="font-sans text-muted-foreground max-w-xl text-sm tracking-wide">
            Track your performance against congressional trading patterns.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm mt-8">
          <HardHat size={48} className="text-muted-foreground mb-6" />
          <h3 className="font-serif text-3xl font-bold text-primary mb-4">Work in Progress</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            The portfolio tracking feature is currently under development. Soon, you'll be able to link your brokerage and compare your returns directly against congressional indices.
          </p>
        </div>
      </div>
    </div>
  )
}
