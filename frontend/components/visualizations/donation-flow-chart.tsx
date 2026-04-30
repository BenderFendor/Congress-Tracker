"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ResponsiveContainer, Sankey, Tooltip } from "recharts"

interface DonationFlowData {
  nodes: Array<{ name: string; category?: string }>
  links: Array<{ source: number; target: number; value: number }>
}

interface DonationFlowChartProps {
  data: DonationFlowData
  title?: string
  description?: string
}

export function DonationFlowChart({
  data,
  title = "Money Flow Analysis",
  description = "Track how donations flow from organizations to legislators",
}: DonationFlowChartProps) {
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { source?: { name: string }; target?: { name: string }; value: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">
            {data.source?.name} → {data.target?.name}
          </p>
          <p className="text-primary font-bold">${(data.value / 1000).toFixed(0)}K</p>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <Sankey data={data} nodeWidth={10} nodePadding={60} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Tooltip content={<CustomTooltip />} />
            </Sankey>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
