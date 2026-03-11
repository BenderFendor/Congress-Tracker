"use client"

import { DollarSign, HardHat } from "lucide-react"

export default function NetWorthPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 md:px-12 py-12">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <DollarSign size={20} strokeWidth={2} />
            </div>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-primary">Congressional Net Worth</h2>
          </div>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Track and analyze the personal wealth and financial disclosures of members of Congress.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm">
          <HardHat size={48} className="text-muted-foreground mb-6" />
          <h3 className="font-serif text-3xl font-bold text-primary mb-4">Work in Progress</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Net worth estimation and analysis features are currently under development. Real-time connections to financial disclosure records are being established.
          </p>
        </div>
      </div>
    </div>
  )
}
