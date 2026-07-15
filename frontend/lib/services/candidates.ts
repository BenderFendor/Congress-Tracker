import { BACKEND_URL } from "@/lib/constants"
import {
  getFecDisbursements,
  getFecReceipts,
  type FECDisbursementResponse,
  type FECReceiptResponse,
} from "@/lib/services/fec"

export type CandidateDetail = {
  candidate_id: string
  name: string
  party?: string | null
  state?: string | null
  district?: string | null
  office?: string | null
  incumbent_challenge?: string | null
  active_through?: number | null
  first_file_date?: string | null
  last_file_date?: string | null
}

export type CandidateCommitteeLink = {
  committee_id: string
  committee_name: string
  election_cycle: number
  committee_type?: string | null
  committee_designation?: string | null
  is_principal: boolean
}

export type CandidateDetailResponse = {
  candidate: CandidateDetail
  committees: CandidateCommitteeLink[]
  coverage: {
    candidate: "loaded"
    committee_links: "loaded" | "not_loaded"
    requested_cycle?: number | null
    warnings: string[]
  }
  provenance: {
    source: string
    source_url: string
    scope: string
  }
}

export type CandidateFinanceChannels = {
  committee: CandidateCommitteeLink
  receipts: FECReceiptResponse | null
  disbursements: FECDisbursementResponse | null
  receiptError: string | null
  disbursementError: string | null
}

export async function getCandidateDetail(
  candidateId: string,
  cycle?: number,
  signal?: AbortSignal,
): Promise<CandidateDetailResponse> {
  const params = new URLSearchParams()
  if (cycle != null) params.set("cycle", String(cycle))
  const suffix = params.size > 0 ? `?${params.toString()}` : ""
  const response = await fetch(
    `${BACKEND_URL}/api/elections/candidates/${encodeURIComponent(candidateId)}${suffix}`,
    { cache: "no-store", signal },
  )
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Failed to fetch candidate dossier: ${response.status} ${detail}`)
  }
  return response.json()
}

export function principalCommittee(
  response: CandidateDetailResponse,
): CandidateCommitteeLink | null {
  return response.committees.find((committee) => committee.is_principal)
    ?? response.committees[0]
    ?? null
}

export async function getCandidateFinanceChannels(
  committee: CandidateCommitteeLink,
): Promise<CandidateFinanceChannels> {
  const query = {
    committeeId: committee.committee_id,
    cycle: committee.election_cycle,
    page: 1,
    perPage: 25,
  }

  const [receipts, disbursements] = await Promise.allSettled([
    getFecReceipts(query),
    getFecDisbursements(query),
  ])

  return {
    committee,
    receipts: receipts.status === "fulfilled" ? receipts.value : null,
    disbursements: disbursements.status === "fulfilled" ? disbursements.value : null,
    receiptError: receipts.status === "rejected"
      ? receipts.reason instanceof Error
        ? receipts.reason.message
        : "Receipt records could not be loaded"
      : null,
    disbursementError: disbursements.status === "rejected"
      ? disbursements.reason instanceof Error
        ? disbursements.reason.message
        : "Disbursement records could not be loaded"
      : null,
  }
}
