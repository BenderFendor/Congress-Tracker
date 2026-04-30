"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { formatCurrency } from "@/lib/csvUtils"

interface NetworkNode {
  id: string
  name: string
  type: "legislator" | "organization" | "bill"
  party?: string
  amount?: number
  connections: string[]
}

interface InfluenceNetworkProps {
  nodes: NetworkNode[]
  title?: string
  description?: string
}

export function InfluenceNetwork({
  nodes,
  title = "Influence Network",
  description = "Visualize connections between legislators, organizations, and bills",
}: InfluenceNetworkProps) {
  const getNodeColor = (type: string, party?: string) => {
    switch (type) {
      case "legislator":
        return party === "Democrat" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/50" : party === "Republican" ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50" : "bg-muted text-muted-foreground border-border"
      case "organization":
        return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/50"
      case "bill":
        return "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/50"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="relative flex-1 min-h-[350px] bg-muted/20 border border-border/50 rounded-lg overflow-hidden flex flex-col justify-center p-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 w-full max-w-3xl mx-auto h-full">
            
            {/* Organizations column */}
            <div className="flex flex-col items-center gap-6 w-full md:w-1/3">
              <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Organizations
              </div>
              <div className="flex flex-col gap-4 w-full">
                {nodes.filter((n) => n.type === "organization").slice(0, 3).map((node) => (
                  <div key={node.id} className={`flex items-center gap-3 p-3 rounded-md border backdrop-blur-sm ${getNodeColor(node.type)} transition-all hover:scale-105 duration-300`}>
                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center font-bold shadow-sm shrink-0 border border-current/20">
                      {node.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" title={node.name}>{node.name}</div>
                      {node.amount && (
                        <div className="text-xs font-mono font-semibold">{formatCurrency(node.amount)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Connecting Arrows (Mobile: Down, Desktop: Right) */}
            <div className="flex md:flex-col justify-center gap-2 text-muted-foreground/30 rotate-90 md:rotate-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </div>

            {/* Legislators column */}
            <div className="flex flex-col items-center gap-6 w-full md:w-1/3">
              <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Legislators
              </div>
              <div className="flex flex-col gap-4 w-full">
                {nodes.filter((n) => n.type === "legislator").slice(0, 3).map((node) => (
                  <div key={node.id} className={`flex flex-col items-center justify-center p-3 rounded-md border backdrop-blur-sm ${getNodeColor(node.type, node.party)} transition-all hover:scale-105 duration-300 text-center`}>
                    <div className="text-sm font-bold mb-1">{node.name}</div>
                    <Badge variant="outline" className="text-[10px] uppercase bg-background/50">
                      {node.party}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Connecting Arrows (Mobile: Down, Desktop: Right) */}
            <div className="flex md:flex-col justify-center gap-2 text-muted-foreground/30 rotate-90 md:rotate-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </div>

            {/* Bills column */}
            <div className="flex flex-col items-center gap-6 w-full md:w-1/3">
              <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span> Bills
              </div>
              <div className="flex flex-col gap-4 w-full">
                {nodes.filter((n) => n.type === "bill").slice(0, 3).map((node, index) => (
                  <div key={node.id} className={`flex items-center gap-3 p-3 rounded-md border backdrop-blur-sm ${getNodeColor(node.type)} transition-all hover:scale-105 duration-300`}>
                    <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center font-bold shadow-sm shrink-0 text-xs border border-current/20">
                      {index + 1}
                    </div>
                    <div className="text-sm font-medium truncate" title={node.name}>{node.name}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </CardContent>
    </Card>
  )
}
