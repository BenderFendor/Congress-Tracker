export const MEMBER_TAB_IDS = [
  "overview",
  "funding",
  "votes",
  "bills",
  "trades",
  "connections",
  "disclosures",
  "biography",
]

const MEMBER_TAB_ALIASES = {
  donations: "funding",
  voting: "votes",
}

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function normalizeMemberTab(value) {
  const normalized = MEMBER_TAB_ALIASES[value] ?? value
  return MEMBER_TAB_IDS.includes(normalized ?? "") ? normalized : "overview"
}

/**
 * @param {string} current
 * @param {"ArrowLeft" | "ArrowRight" | "Home" | "End"} key
 * @returns {string}
 */
export function nextMemberTab(current, key) {
  const currentIndex = Math.max(0, MEMBER_TAB_IDS.indexOf(normalizeMemberTab(current)))
  if (key === "Home") return MEMBER_TAB_IDS[0]
  if (key === "End") return MEMBER_TAB_IDS[MEMBER_TAB_IDS.length - 1]
  const delta = key === "ArrowRight" ? 1 : -1
  return MEMBER_TAB_IDS[(currentIndex + delta + MEMBER_TAB_IDS.length) % MEMBER_TAB_IDS.length]
}

/**
 * @param {string} href
 * @param {string} tab
 * @returns {string}
 */
export function memberTabHref(href, tab) {
  const url = new URL(href, "https://example.invalid")
  const normalized = normalizeMemberTab(tab)
  if (normalized === "overview") url.searchParams.delete("tab")
  else url.searchParams.set("tab", normalized)
  return `${url.pathname}${url.search}${url.hash}`
}
