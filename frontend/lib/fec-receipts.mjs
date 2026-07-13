export function buildFecReceiptQuery(input) {
  const params = new URLSearchParams()
  const committeeId = input.committeeId?.trim()
  const search = input.search?.trim()
  const recordKind = input.recordKind?.trim()

  if (committeeId) params.set("committee_id", committeeId)
  if (input.cycle) params.set("cycle", String(input.cycle))
  if (search) params.set("q", search)
  if (recordKind) params.set("record_kind", recordKind)
  if (Number.isFinite(input.minAmount)) params.set("min_amount", String(input.minAmount))
  if (Number.isFinite(input.maxAmount)) params.set("max_amount", String(input.maxAmount))
  params.set("page", String(Math.max(1, Number(input.page) || 1)))
  params.set("per_page", String(Math.min(200, Math.max(1, Number(input.perPage) || 50))))

  return params.toString()
}

export function parseOptionalReceiptNumber(value) {
  const candidate = Array.isArray(value) ? value[0] : value
  const raw = String(candidate ?? "").trim()
  if (!raw) return undefined

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function buildFecReceiptHref(input) {
  return `/fec/receipts?${buildFecReceiptQuery(input)}`
}
