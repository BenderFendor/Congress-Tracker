import type { Legislator, MemberLegislationResponse } from "@/lib/services/legislators"
import type { MemberFunding } from "@/lib/services/funding"
import type { MemberVotesResult } from "@/lib/services/voting"
import type { MemberDisclosures, RelationshipsResponse } from "@/lib/services/relationships"
import type { TradesResponse } from "@/lib/services/stocks"

export const MEMBER_TABS = [
  { id: "overview", label: "Overview" },
  { id: "funding", label: "Funding" },
  { id: "votes", label: "Votes" },
  { id: "bills", label: "Bills" },
  { id: "trades", label: "Trades" },
  { id: "connections", label: "Connections" },
  { id: "disclosures", label: "Disclosures" },
  { id: "biography", label: "Biography" },
] as const

export type MemberTab = (typeof MEMBER_TABS)[number]["id"]
export type FetchableMemberTab = Exclude<MemberTab, "overview" | "biography">
export type ResourceStatus = "idle" | "loading" | "loaded" | "error"

export type ResourceState<T> = {
  status: ResourceStatus
  data: T | null
  error: string | null
}

export type MemberDossierResources = {
  profile: ResourceState<Legislator>
  funding: ResourceState<MemberFunding>
  votes: ResourceState<MemberVotesResult>
  legislation: ResourceState<MemberLegislationResponse>
  trades: ResourceState<TradesResponse>
  relationships: ResourceState<RelationshipsResponse>
  disclosures: ResourceState<MemberDisclosures>
}

export type LegislationSection = "sponsor" | "cosponsor" | "related_items"
