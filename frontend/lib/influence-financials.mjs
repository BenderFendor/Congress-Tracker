export const FLOW_KEYS = [
  "total_direct_contributions",
  "total_independent_supporting",
  "total_independent_opposing",
]

export function safeMoney(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

export function buildInfluenceFlow(financials) {
  if (!financials) return null

  const channels = [
    { key: "direct", label: "Direct contributions", amount: safeMoney(financials.total_direct_contributions), tone: "direct" },
    { key: "support", label: "Independent support", amount: safeMoney(financials.total_independent_supporting), tone: "support" },
    { key: "oppose", label: "Independent opposition", amount: safeMoney(financials.total_independent_opposing), tone: "oppose" },
  ]
  const calculatedTotal = channels.reduce((sum, channel) => sum + channel.amount, 0)
  const reportedTotal = safeMoney(financials.total_all)
  const tolerance = Math.max(0.01, calculatedTotal * 0.000001)
  const reconciled = Math.abs(reportedTotal - calculatedTotal) <= tolerance
  const recipients = Array.isArray(financials.top_recipients)
    ? financials.top_recipients
        .map((recipient) => {
          const direct = safeMoney(recipient.direct_contributions ?? recipient.total_received)
          const support = safeMoney(recipient.independent_supporting)
          const oppose = safeMoney(recipient.independent_opposing)
          const calculatedActivity = direct + support + oppose
          const reportedActivity = safeMoney(recipient.total_activity)
          return {
            ...recipient,
            direct,
            support,
            oppose,
            amount: reportedActivity || calculatedActivity,
          }
        })
        .filter((recipient) => recipient.bioguide_id && recipient.amount > 0)
        .sort((left, right) => right.amount - left.amount)
    : []
  const recipientTotal = recipients.reduce((sum, recipient) => sum + recipient.amount, 0)

  return {
    channels,
    calculatedTotal,
    reportedTotal,
    reconciled,
    recipients,
    recipientTotal,
    recipientCoverage: reportedTotal > 0 ? Math.min(recipientTotal / reportedTotal, 1) : 0,
  }
}
