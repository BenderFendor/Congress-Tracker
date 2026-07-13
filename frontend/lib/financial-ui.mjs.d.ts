import type { FECandidate, FECCommittee } from "@/lib/services/fec"
import type { FinancialSnapshot } from "@/lib/services/financial"

export const INITIAL_DIRECTORY_ROWS: number
export function normalizeDirectoryQuery(value: string): string
export function candidateMatches(candidate: FECandidate, filters: { query: string; state: string; office: string }): boolean
export function committeeMatches(committee: FECCommittee, query: string): boolean
export function formatDisclosureBound(value: number | null, unavailable: boolean, side: "lower" | "upper"): string
export function formatDisclosureRange(snapshot: FinancialSnapshot): string
export function snapshotMatches(snapshot: FinancialSnapshot, filters: { query: string; year: string; chamber: string }): boolean
