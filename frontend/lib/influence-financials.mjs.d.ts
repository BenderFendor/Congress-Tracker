import type { InfluenceNetworkFinancials } from "./services/influence"

export type InfluenceFlowRecipient = InfluenceNetworkFinancials["top_recipients"][number] & { amount: number }

export type InfluenceFlow = {
  channels: Array<{ key: "direct" | "support" | "oppose"; label: string; amount: number; tone: "direct" | "support" | "oppose" }>
  calculatedTotal: number
  reportedTotal: number
  reconciled: boolean
  recipients: InfluenceFlowRecipient[]
  recipientTotal: number
  recipientCoverage: number
}

export function safeMoney(value: unknown): number
export function buildInfluenceFlow(financials: InfluenceNetworkFinancials | null | undefined): InfluenceFlow | null
