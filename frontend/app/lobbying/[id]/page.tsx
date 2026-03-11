"use client"

import { ArrowLeft, HardHat } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function OrganizationProfilePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Search
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-semibold text-foreground">Organization Profile</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm">
          <HardHat size={48} className="text-muted-foreground mb-6" />
          <h3 className="font-serif text-3xl font-bold text-primary mb-4">Work in Progress</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Detailed organizational profiles, lobbying histories, and targeted bill tracking features are currently under development. Please check back later.
          </p>
        </div>
      </div>
    </div>
  )
}
