"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  getCandidateDetail,
  getCandidateFinanceChannels,
  principalCommittee,
  type CandidateDetailResponse,
  type CandidateFinanceChannels,
} from "@/lib/services/candidates"

type Resource<T> = {
  status: "idle" | "loading" | "loaded" | "error"
  data: T | null
  error: string | null
}

const idle = <T,>(): Resource<T> => ({ status: "idle", data: null, error: null })

export function useCandidateDossier(candidateId: string) {
  const [detail, setDetail] = useState<Resource<CandidateDetailResponse>>(() => idle())
  const [finance, setFinance] = useState<Resource<CandidateFinanceChannels>>(() => idle())
  const requestVersion = useRef(0)

  const loadDetail = useCallback(() => {
    const version = requestVersion.current + 1
    requestVersion.current = version
    const controller = new AbortController()
    setDetail((current) => ({ status: "loading", data: current.data, error: null }))
    setFinance(idle())

    getCandidateDetail(candidateId, undefined, controller.signal)
      .then((response) => {
        if (controller.signal.aborted || requestVersion.current !== version) return
        setDetail({ status: "loaded", data: response, error: null })
        const committee = principalCommittee(response)
        if (!committee) {
          setFinance({ status: "loaded", data: null, error: null })
          return
        }
        setFinance({ status: "loading", data: null, error: null })
        void getCandidateFinanceChannels(committee)
          .then((channels) => {
            if (requestVersion.current !== version) return
            setFinance({ status: "loaded", data: channels, error: null })
          })
          .catch((error: unknown) => {
            if (requestVersion.current !== version) return
            setFinance({
              status: "error",
              data: null,
              error: error instanceof Error ? error.message : "Candidate finance channels could not be loaded",
            })
          })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestVersion.current !== version) return
        setDetail({
          status: "error",
          data: null,
          error: error instanceof Error ? error.message : "Candidate dossier could not be loaded",
        })
      })

    return () => controller.abort()
  }, [candidateId])

  useEffect(() => {
    const cancel = loadDetail()
    return cancel
  }, [loadDetail])

  const retryFinance = useCallback(() => {
    const response = detail.data
    const committee = response ? principalCommittee(response) : null
    if (!committee) return
    const version = requestVersion.current
    setFinance((current) => ({ status: "loading", data: current.data, error: null }))
    void getCandidateFinanceChannels(committee)
      .then((channels) => {
        if (requestVersion.current !== version) return
        setFinance({ status: "loaded", data: channels, error: null })
      })
      .catch((error: unknown) => {
        if (requestVersion.current !== version) return
        setFinance((current) => ({
          status: "error",
          data: current.data,
          error: error instanceof Error ? error.message : "Candidate finance channels could not be loaded",
        }))
      })
  }, [detail.data])

  return { detail, finance, retryDetail: loadDetail, retryFinance }
}
