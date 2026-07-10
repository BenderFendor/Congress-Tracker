"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { formatCurrency } from "@/lib/csvUtils"

interface CampaignFinanceData {
  name: string
  amount: number
  industry?: string
  color?: string
}

interface CampaignFinanceChartProps {
  data: CampaignFinanceData[]
  type?: "bar" | "pie"
  title?: string
  description?: string
  emptyMessage?: string
}
export function CampaignFinanceChart({
  data,
  type = "bar",
  title = "Campaign Finance Breakdown",
  description = "Analysis of campaign contributions by source",
  emptyMessage,
}: CampaignFinanceChartProps) {
  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ]

  const renderPieLabel = ({ name, percent }: { name?: unknown; percent?: number }) => {
    const safeName = typeof name === "string" ? name : ""
    const safePercent = typeof percent === "number" ? percent : 0
    return `${safeName} ${(safePercent * 100).toFixed(0)}%`
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: CampaignFinanceData }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-primary font-bold">{formatCurrency(payload[0].value)}</p>
          {payload[0].payload.industry && (
            <p className="text-sm text-muted-foreground">{payload[0].payload.industry}</p>
          )}
        </div>
      )
    }
    return null
  }

  const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { total: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-primary font-bold">{formatCurrency(data.value)}</p>
          <p className="text-sm text-muted-foreground">{((data.value / data.payload.total) * 100).toFixed(1)}%</p>
        </div>
      )
    }
    return null
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-80 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            {emptyMessage || "No campaign finance records match the current filters."}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (type === "pie") {
    const total = data.reduce((sum, item) => sum + item.amount, 0)
    const dataWithTotal = data.map((item) => ({ ...item, total }))

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataWithTotal}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderPieLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {dataWithTotal.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                className="text-muted-foreground"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                className="text-muted-foreground"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
