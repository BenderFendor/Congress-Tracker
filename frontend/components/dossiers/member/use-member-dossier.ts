"use client"

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { getLegislator, getMemberLegislation } from "@/lib/services/legislators"
import { getMemberFunding } from "@/lib/services/funding"
import { getMemberVotes } from "@/lib/services/voting"
import { getTradesByMemberId } from "@/lib/services/stocks"
import { getMemberDisclosures, getRelationships } from "@/lib/services/relationships"
import { memberTabHref, normalizeMemberTab } from "@/lib/member-dossier-state.mjs"
import type {
  FetchableMemberTab,
  LegislationSection,
  MemberDossierResources,
  MemberTab,
  ResourceState,
} from "./types"

function idleResource<T>(): ResourceState<T> {
  return { status: "idle", data: null, error: null }
}

function initialResources(): MemberDossierResources {
  return {
    profile: idleResource(),
    funding: idleResource(),
    votes: idleResource(),
    legislation: idleResource(),
    trades: idleResource(),
    relationships: idleResource(),
    disclosures: idleResource(),
  }
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === "AbortError") return null
  if (error instanceof Error && error.name === "AbortError") return null
  return error instanceof Error ? error.message : fallback
}

export function useMemberDossier(memberId: string) {
  const [activeTab, setActiveTab] = useState<MemberTab>("overview")
  const [resources, setResources] = useState<MemberDossierResources>(() => initialResources())
  const resourcesRef = useRef(resources)
  const memberIdRef = useRef(memberId)
  const profileRequest = useRef<AbortController | null>(null)
  const requests = useRef<Partial<Record<FetchableMemberTab, AbortController>>>({})

  resourcesRef.current = resources
  memberIdRef.current = memberId

  const updateResource = useCallback(<K extends keyof MemberDossierResources>(
    key: K,
    state: SetStateAction<MemberDossierResources[K]>,
  ) => {
    setResources((current) => ({
      ...current,
      [key]: typeof state === "function"
        ? (state as (previous: MemberDossierResources[K]) => MemberDossierResources[K])(current[key])
        : state,
    }))
  }, [])

  useEffect(() => {
    const readTab = () => {
      const requested = new URLSearchParams(window.location.search).get("tab")
      setActiveTab(normalizeMemberTab(requested) as MemberTab)
    }
    readTab()
    window.addEventListener("popstate", readTab)
    return () => window.removeEventListener("popstate", readTab)
  }, [memberId])

  useEffect(() => {
    profileRequest.current?.abort()
    for (const controller of Object.values(requests.current)) controller?.abort()
    requests.current = {}

    const controller = new AbortController()
    profileRequest.current = controller
    const requestedMember = memberId
    setResources({ ...initialResources(), profile: { status: "loading", data: null, error: null } })

    getLegislator(requestedMember, controller.signal)
      .then((member) => {
        if (controller.signal.aborted || memberIdRef.current !== requestedMember) return
        setResources((current) => ({
          ...current,
          profile: { status: "loaded", data: member, error: null },
          trades: member
            ? {
                status: member.tradeCoverage.status === "unavailable" ? "error" : "loaded",
                data: {
                  trades: member.recentTrades,
                  total: member.tradeCoverage.total,
                  limit: 100,
                  offset: member.tradeCoverage.offset,
                  tickers: [...new Set(member.recentTrades.map((trade) => trade.ticker).filter((ticker): ticker is string => Boolean(ticker)))],
                  coverage: {
                    status: member.tradeCoverage.status === "loaded" ? "loaded" : "not_loaded",
                    message: member.tradeCoverage.message,
                    has_more: member.tradeCoverage.hasMore,
                    excluded_date_anomalies: member.tradeCoverage.excludedDateAnomalies,
                  },
                },
                error: member.tradeCoverage.status === "unavailable" ? member.tradeCoverage.message : null,
              }
            : idleResource(),
        }))
      })
      .catch((error) => {
        const message = errorMessage(error, "Member profile request failed")
        if (!message || memberIdRef.current !== requestedMember) return
        updateResource("profile", { status: "error", data: null, error: message })
      })

    return () => controller.abort()
  }, [memberId, updateResource])

  const runResource = useCallback(async <T,>(
    tab: FetchableMemberTab,
    key: keyof Omit<MemberDossierResources, "profile">,
    setter: Dispatch<SetStateAction<ResourceState<T>>>,
    task: (signal: AbortSignal) => Promise<T>,
    fallback: string,
    force = false,
  ) => {
    const snapshot = resourcesRef.current[key] as ResourceState<T>
    if (!force && (snapshot.status === "loading" || snapshot.status === "loaded")) return

    requests.current[tab]?.abort()
    const controller = new AbortController()
    requests.current[tab] = controller
    const requestedMember = memberIdRef.current
    setter((current) => ({ status: "loading", data: current.data, error: null }))

    try {
      const data = await task(controller.signal)
      if (controller.signal.aborted || memberIdRef.current !== requestedMember) return
      setter({ status: "loaded", data, error: null })
    } catch (error) {
      const message = errorMessage(error, fallback)
      if (!message || memberIdRef.current !== requestedMember) return
      setter((current) => ({ status: "error", data: current.data, error: message }))
    }
  }, [])

  const resourceSetter = useCallback(<K extends keyof Omit<MemberDossierResources, "profile">>(key: K) => {
    return ((state: SetStateAction<MemberDossierResources[K]>) => updateResource(key, state)) as Dispatch<SetStateAction<MemberDossierResources[K]>>
  }, [updateResource])

  const loadTab = useCallback((tab: MemberTab, force = false) => {
    const profile = resourcesRef.current.profile.data
    if (!profile) return Promise.resolve()
    const bioguideId = profile.bioguide_id || profile.id

    switch (tab) {
      case "funding":
        return runResource(
          "funding",
          "funding",
          resourceSetter("funding"),
          (signal) => getMemberFunding(bioguideId, undefined, signal).then((data) => {
            if (!data) throw new Error("No campaign-finance record is loaded for this member")
            return data
          }),
          "Funding records could not be loaded",
          force,
        )
      case "votes":
        return runResource(
          "votes",
          "votes",
          resourceSetter("votes"),
          (signal) => getMemberVotes(bioguideId, 119, signal),
          "Vote records could not be loaded",
          force,
        )
      case "bills":
        return runResource(
          "bills",
          "legislation",
          resourceSetter("legislation"),
          (signal) => getMemberLegislation(bioguideId, { limit: 25 }, signal),
          "Legislation records could not be loaded",
          force,
        )
      case "trades":
        return runResource(
          "trades",
          "trades",
          resourceSetter("trades"),
          (signal) => getTradesByMemberId(bioguideId, 100, 0, signal),
          "Disclosure transactions could not be loaded",
          force,
        )
      case "connections":
        return runResource(
          "connections",
          "relationships",
          resourceSetter("relationships"),
          (signal) => getRelationships({ subjectKey: `member:${bioguideId}`, limit: 100 }, signal),
          "Relationship evidence could not be loaded",
          force,
        )
      case "disclosures":
        return runResource(
          "disclosures",
          "disclosures",
          resourceSetter("disclosures"),
          (signal) => getMemberDisclosures(bioguideId, signal),
          "Financial disclosures could not be loaded",
          force,
        )
      default:
        return Promise.resolve()
    }
  }, [resourceSetter, runResource])

  useEffect(() => {
    if (resources.profile.status === "loaded" && resources.profile.data) {
      void loadTab(activeTab)
    }
  }, [activeTab, loadTab, resources.profile.data, resources.profile.status])

  const selectTab = useCallback((tab: MemberTab, replace = false) => {
    setActiveTab(tab)
    const nextHref = memberTabHref(window.location.href, tab)
    if (replace) window.history.replaceState(window.history.state, "", nextHref)
    else window.history.pushState(window.history.state, "", nextHref)
  }, [])

  const loadTradesPage = useCallback((offset: number) => {
    const profile = resourcesRef.current.profile.data
    if (!profile) return Promise.resolve()
    const bioguideId = profile.bioguide_id || profile.id
    return runResource(
      "trades",
      "trades",
      resourceSetter("trades"),
      (signal) => getTradesByMemberId(bioguideId, 100, Math.max(0, offset), signal),
      "Disclosure transactions could not be loaded",
      true,
    )
  }, [resourceSetter, runResource])

  const loadLegislationPage = useCallback((section: LegislationSection, offset: number) => {
    const profile = resourcesRef.current.profile.data
    const current = resourcesRef.current.legislation.data
    if (!profile) return Promise.resolve()
    const bioguideId = profile.bioguide_id || profile.id
    return runResource(
      "bills",
      "legislation",
      resourceSetter("legislation"),
      (signal) => getMemberLegislation(bioguideId, {
        limit: current?.pagination.sponsor.limit ?? 25,
        sponsorOffset: section === "sponsor" ? Math.max(0, offset) : current?.pagination.sponsor.offset ?? 0,
        cosponsorOffset: section === "cosponsor" ? Math.max(0, offset) : current?.pagination.cosponsor.offset ?? 0,
        relatedOffset: section === "related_items" ? Math.max(0, offset) : current?.pagination.related_items.offset ?? 0,
      }, signal),
      "Legislation records could not be loaded",
      true,
    )
  }, [resourceSetter, runResource])

  const loadedCount = useMemo(() => Object.values(resources).filter((resource) => resource.status === "loaded").length, [resources])

  return {
    activeTab,
    resources,
    loadedCount,
    selectTab,
    loadTab,
    loadTradesPage,
    loadLegislationPage,
  }
}
