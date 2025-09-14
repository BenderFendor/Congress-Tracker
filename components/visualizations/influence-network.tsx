"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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
        return party === "Democrat" ? "bg-blue-500" : party === "Republican" ? "bg-red-500" : "bg-gray-500"
      case "organization":
        return "bg-green-500"
      case "bill":
        return "bg-purple-500"
      default:
        return "bg-gray-500"
    }
  }

  const getNodeSize = (type: string, amount?: number) => {
    if (type === "organization" && amount) {
      if (amount > 1000000) return "w-16 h-16"
      if (amount > 500000) return "w-12 h-12"
      return "w-8 h-8"
    }
    return "w-10 h-10"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-96 bg-muted/20 rounded-lg overflow-hidden">
          {/* Network visualization placeholder - in a real implementation, this would use D3.js */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="grid grid-cols-3 gap-8 items-center">
              {/* Organizations column */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-center">Organizations</h4>
                {nodes
                  .filter((n) => n.type === "organization")
                  .slice(0, 3)
                  .map((node, index) => (
                    <div key={node.id} className="flex flex-col items-center">
                      <div
                        className={`${getNodeColor(node.type)} ${getNodeSize(node.type, node.amount)} rounded-full flex items-center justify-center text-white text-xs font-bold`}
                      >
                        {node.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="text-xs text-center mt-1 max-w-20">{node.name}</div>
                      {node.amount && (
                        <div className="text-xs text-primary font-bold">${(node.amount / 1000).toFixed(0)}K</div>
                      )}
                    </div>
                  ))}
              </div>

              {/* Legislators column */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-center">Legislators</h4>
                {nodes
                  .filter((n) => n.type === "legislator")
                  .slice(0, 3)
                  .map((node, index) => (
                    <div key={node.id} className="flex flex-col items-center">
                      <div
                        className={`${getNodeColor(node.type, node.party)} ${getNodeSize(node.type)} rounded-full flex items-center justify-center text-white text-xs font-bold`}
                      >
                        {node.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div className="text-xs text-center mt-1 max-w-20">{node.name}</div>
                      <Badge variant="outline" className="text-xs mt-1">
                        {node.party}
                      </Badge>
                    </div>
                  ))}
              </div>

              {/* Bills column */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-center">Bills</h4>
                {nodes
                  .filter((n) => n.type === "bill")
                  .slice(0, 3)
                  .map((node, index) => (
                    <div key={node.id} className="flex flex-col items-center">
                      <div
                        className={`${getNodeColor(node.type)} ${getNodeSize(node.type)} rounded-full flex items-center justify-center text-white text-xs font-bold`}
                      >
                        {index + 1}
                      </div>
                      <div className="text-xs text-center mt-1 max-w-20">{node.name}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Connection lines - simplified representation */}
          <svg className="absolute inset-0 pointer-events-none">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-muted-foreground" />
              </marker>
            </defs>
            {/* Sample connection lines */}
            <line
              x1="25%"
              y1="30%"
              x2="50%"
              y2="30%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
              markerEnd="url(#arrowhead)"
            />
            <line
              x1="25%"
              y1="50%"
              x2="50%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
              markerEnd="url(#arrowhead)"
            />
            <line
              x1="50%"
              y1="30%"
              x2="75%"
              y2="30%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
              markerEnd="url(#arrowhead)"
            />
            <line
              x1="50%"
              y1="50%"
              x2="75%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
              markerEnd="url(#arrowhead)"
            />
          </svg>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-xs">Democrat</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-xs">Republican</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-xs">Organization</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-xs">Bill</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
