export function canonicalBioguideId(value) {
  const normalized = String(value || "").trim().toUpperCase()
  return /^[A-Z]\d{6}$/.test(normalized) ? normalized : ""
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isUsablePortraitUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" && url.protocol !== "http:") return false
    const path = url.pathname.toLowerCase()
    if (url.hostname === "api.congress.gov") return false
    if (/\.(json|xml|html?)$/.test(path)) return false
    if (url.searchParams.get("format")?.toLowerCase() === "json") return false
    return true
  } catch {
    return false
  }
}

export function officialBioguidePortrait(value) {
  const id = canonicalBioguideId(value)
  return id ? `https://bioguide.congress.gov/bioguide/photo/${id[0]}/${id}.jpg` : ""
}

/**
 * @param {{ bioguideId?: unknown, suppliedUrls?: (string | null | undefined)[] }} input
 * @returns {string[]}
 */
export function memberPortraitCandidates({ bioguideId, suppliedUrls = [] }) {
  const official = officialBioguidePortrait(bioguideId)
  return [...new Set([...suppliedUrls.filter(isUsablePortraitUrl), official].filter(Boolean))]
}

export function memberInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?"
}
