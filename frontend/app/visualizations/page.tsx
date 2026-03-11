"use client"

import { HardHat } from "lucide-react"

export default function VisualizationsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 md:px-12 py-12">
        <div className="mb-12">
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-primary mb-4">Interactive Data Analysis</h2>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Explore the complex relationships between money, politics, and legislation through interactive
            visualizations.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm mt-8">
          <HardHat size={48} className="text-muted-foreground mb-6" />
          <h3 className="font-serif text-3xl font-bold text-primary mb-4">Work in Progress</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Interactive visualizations for campaign finance, influence networks, and lobbying timelines are currently under development. We are actively working on wiring these charts to live data sources.
          </p>
        </div>
      </div>
    </div>
  )
}

