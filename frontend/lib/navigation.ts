export type NavigationSection = "Core research" | "Money and disclosures" | "Lobbying entities" | "Evidence tools"

export type NavigationItem = {
  href: string
  label: string
  description: string
  section: NavigationSection
  keywords: readonly string[]
  primary?: boolean
}

export const navigationItems: readonly NavigationItem[] = [
  { href: "/", label: "Home", description: "Current public-record coverage", section: "Core research", keywords: ["dashboard", "overview"] },
  { href: "/legislators", label: "Legislators", description: "Members of Congress and evidence profiles", section: "Core research", keywords: ["members", "representatives", "senators"], primary: true },
  { href: "/bills", label: "Bills", description: "Legislation, votes, sponsors, and related evidence", section: "Core research", keywords: ["legislation", "congress"], primary: true },
  { href: "/committees", label: "Committees", description: "Committee membership and jurisdiction", section: "Core research", keywords: ["house", "senate"], primary: true },
  { href: "/influence", label: "Influence networks", description: "Source-backed political influence relationships", section: "Core research", keywords: ["network", "relationships"], primary: true },
  { href: "/candidates", label: "Candidates and PACs", description: "Campaign candidates and FEC committees", section: "Money and disclosures", keywords: ["election", "committee", "organization", "pac"] },
  { href: "/fec/receipts", label: "FEC receipts", description: "Canonical Schedule A campaign receipts", section: "Money and disclosures", keywords: ["contributions", "donations", "schedule a"] },
  { href: "/fec/disbursements", label: "FEC disbursements", description: "Canonical Schedule B campaign spending", section: "Money and disclosures", keywords: ["spending", "expenses", "schedule b"] },
  { href: "/portfolio", label: "Financial disclosures", description: "Congressional stock transaction disclosures", section: "Money and disclosures", keywords: ["stocks", "trades", "ptr"], primary: true },
  { href: "/networth", label: "Net-worth snapshots", description: "Range-based annual financial snapshots", section: "Money and disclosures", keywords: ["assets", "liabilities", "wealth"] },
  { href: "/elections", label: "Elections", description: "Election geography and candidate context", section: "Money and disclosures", keywords: ["map", "districts", "races"] },
  { href: "/lobbying", label: "Lobbying filings", description: "Federal lobbying disclosure filings", section: "Lobbying entities", keywords: ["lda", "reports"] },
  { href: "/lobbying/clients", label: "Lobbying clients", description: "Organizations that retain lobbyists", section: "Lobbying entities", keywords: ["organizations", "employers"] },
  { href: "/lobbying/registrants", label: "Lobbying registrants", description: "Registered lobbying firms and organizations", section: "Lobbying entities", keywords: ["firms", "lda"] },
  { href: "/lobbying/lobbyists", label: "Lobbyists", description: "Named lobbyists and filing histories", section: "Lobbying entities", keywords: ["people", "covered positions"] },
  { href: "/visualizations", label: "Visualizations", description: "Source-scoped campaign-finance comparisons", section: "Evidence tools", keywords: ["charts", "graphs", "cycle"] },
  { href: "/search", label: "Search all records", description: "Search members, bills, committees, PACs, and lobbying entities", section: "Evidence tools", keywords: ["organizations", "lookup", "find"] },
  { href: "/data-sources", label: "Data sources", description: "Provider coverage and freshness", section: "Evidence tools", keywords: ["provenance", "status", "coverage"] },
  { href: "/methodology", label: "Methodology", description: "How evidence is normalized and qualified", section: "Evidence tools", keywords: ["confidence", "process", "limitations"] },
  { href: "/api-docs", label: "API documentation", description: "Programmatic access to public-record data", section: "Evidence tools", keywords: ["developers", "endpoints"] },
] as const

export const primaryNavigationItems = navigationItems.filter((item) => item.primary)
export const exploreNavigationItems = navigationItems.filter((item) => !item.primary && item.href !== "/")
export const navigationSections: readonly NavigationSection[] = [
  "Core research",
  "Money and disclosures",
  "Lobbying entities",
  "Evidence tools",
]

export function navigationItemMatches(item: NavigationItem, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true
  return [item.label, item.description, ...item.keywords]
    .some((value) => value.toLowerCase().includes(normalizedQuery))
}
