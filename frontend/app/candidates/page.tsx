"use client"

// Design direction: Campaign record desk. A compact filter rail opens directly into source-identified records.
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Building2, ChevronDown, ExternalLink, FileSearch, MapPin, RotateCcw, Search, ShieldCheck, UserRound } from "lucide-react"

import { ArchiveHero, ArchiveMetrics, ArchivePage, DataState, EvidenceSpine } from "@/components/ui/archive-ui"
import { candidateMatches, committeeMatches, INITIAL_DIRECTORY_ROWS } from "@/lib/financial-ui.mjs"
import { buildFecReceiptHref } from "@/lib/fec-receipts.mjs"
import { getAllCandidates, getCommittees, type FECandidate, type FECCommittee } from "@/lib/services/fec"
import { createLogger } from "@/lib/tracing"
import { requestTruthState } from "@/lib/truth-states.mjs"

const log = createLogger("CandidatesPage")

function officeLabel(office?: string) {
  if (office === "H") return "U.S. House"
  if (office === "S") return "U.S. Senate"
  if (office === "P") return "President"
  return office || "Office unavailable"
}

function partyClass(party?: string) {
  const value = party?.toLowerCase() || ""
  if (value.includes("dem")) return "candidate-party-dem"
  if (value.includes("rep")) return "candidate-party-rep"
  return "candidate-party-other"
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<FECandidate[]>([])
  const [committees, setCommittees] = useState<FECCommittee[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(true)
  const [committeesLoading, setCommitteesLoading] = useState(true)
  const [candidatesError, setCandidatesError] = useState<string | null>(null)
  const [committeesError, setCommitteesError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [state, setState] = useState("all")
  const [office, setOffice] = useState("all")
  const [committeeQuery, setCommitteeQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"candidates" | "committees">("candidates")
  const [visibleCount, setVisibleCount] = useState(INITIAL_DIRECTORY_ROWS)

  const loadCandidates = useCallback(async () => {
    setCandidatesLoading(true)
    setCandidatesError(null)
    try {
      setCandidates(await getAllCandidates())
    } catch (error) {
      const message = error instanceof Error ? error.message : "The candidate directory request failed"
      setCandidatesError(message)
      log.error("Failed to load candidates", { error: String(error) })
    } finally {
      setCandidatesLoading(false)
    }
  }, [])

  const loadCommittees = useCallback(async () => {
    setCommitteesLoading(true)
    setCommitteesError(null)
    try {
      setCommittees(await getCommittees())
    } catch (error) {
      const message = error instanceof Error ? error.message : "The committee directory request failed"
      setCommitteesError(message)
      log.error("Failed to load committees", { error: String(error) })
    } finally {
      setCommitteesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCandidates()
    void loadCommittees()
  }, [loadCandidates, loadCommittees])

  const states = useMemo(() => [...new Set(candidates.map((candidate) => candidate.state).filter(Boolean))].sort(), [candidates])
  const offices = useMemo(() => [...new Set(candidates.map((candidate) => candidate.office_sought).filter(Boolean))].sort(), [candidates])
  const filteredCandidates = useMemo(
    () => candidates.filter((candidate) => candidateMatches(candidate, { query, state, office })),
    [candidates, office, query, state],
  )
  const filteredCommittees = useMemo(
    () => committees.filter((committee) => committeeMatches(committee, committeeQuery)).sort((a, b) => (a.committee_name || "").localeCompare(b.committee_name || "")),
    [committees, committeeQuery],
  )
  const activeRows = activeTab === "candidates" ? filteredCandidates : filteredCommittees
  const candidateState = requestTruthState({ loading: candidatesLoading, error: candidatesError, responseLoaded: true, count: filteredCandidates.length })
  const committeeState = requestTruthState({ loading: committeesLoading, error: committeesError, responseLoaded: true, count: filteredCommittees.length })
  const activeFilters = Number(Boolean(query.trim())) + Number(state !== "all") + Number(office !== "all")

  function clearCandidateFilters() {
    setQuery("")
    setState("all")
    setOffice("all")
    setVisibleCount(INITIAL_DIRECTORY_ROWS)
  }

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Federal campaign records"
        title="Candidate"
        accent="directory"
        description="Search federal candidates and political committees by the identifiers published in FEC records. Candidate and committee requests remain independently reported."
        mode="capitol"
        aside={(
          <EvidenceSpine
            source="Federal Election Commission"
            status={candidatesError || committeesError ? "Partial request failure" : candidatesLoading || committeesLoading ? "Loading source records" : "Source records loaded"}
            coverage={`${candidates.length.toLocaleString()} candidates · ${committees.length.toLocaleString()} committees`}
            sourceUrl="https://www.fec.gov/data/"
          >
            <p className="text-sm leading-6 text-muted-foreground">A directory record identifies a filing entity. It does not imply current ballot qualification or electoral viability.</p>
          </EvidenceSpine>
        )}
      />

      <ArchiveMetrics metrics={[
        { label: "Candidates loaded", value: candidatesLoading ? "…" : candidatesError ? "Unavailable" : candidates.length, detail: "Independent API request", icon: <UserRound size={19} /> },
        { label: "Committees loaded", value: committeesLoading ? "…" : committeesError ? "Unavailable" : committees.length, detail: "PAC and committee records", icon: <Building2 size={19} /> },
        { label: "States in response", value: candidatesError ? "Unavailable" : states.length, detail: "Derived from loaded rows", icon: <MapPin size={19} /> },
        { label: "Official identifiers", value: "Preserved", detail: "Candidate and committee IDs", icon: <ShieldCheck size={19} /> },
      ]} />

      <div className="candidate-tabs" aria-label="Campaign finance directories" role="tablist">
        <button id="candidates-tab" role="tab" aria-controls="candidates-panel" aria-selected={activeTab === "candidates"} onClick={() => { setActiveTab("candidates"); setVisibleCount(INITIAL_DIRECTORY_ROWS) }}>Candidates <span>{candidates.length.toLocaleString()}</span></button>
        <button id="committees-tab" role="tab" aria-controls="committees-panel" aria-selected={activeTab === "committees"} onClick={() => { setActiveTab("committees"); setVisibleCount(INITIAL_DIRECTORY_ROWS) }}>PAC committees <span>{committees.length.toLocaleString()}</span></button>
      </div>

      <section className="candidate-workbench" aria-label="Directory filters">
        {activeTab === "candidates" ? (
          <>
            <label className="candidate-search"><Search size={17} /><span className="sr-only">Search candidates</span><input type="search" placeholder="Name or FEC candidate ID" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(INITIAL_DIRECTORY_ROWS) }} /></label>
            <label className="candidate-select"><span className="sr-only">Candidate state</span><select value={state} onChange={(event) => { setState(event.target.value); setVisibleCount(INITIAL_DIRECTORY_ROWS) }}><option value="all">All states</option>{states.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
            <label className="candidate-select"><span className="sr-only">Office sought</span><select value={office} onChange={(event) => { setOffice(event.target.value); setVisibleCount(INITIAL_DIRECTORY_ROWS) }}><option value="all">All offices</option>{offices.map((value) => <option key={value} value={value}>{officeLabel(value)}</option>)}</select><ChevronDown size={14} /></label>
            {activeFilters > 0 ? <button className="candidate-clear" type="button" onClick={clearCandidateFilters}><RotateCcw size={14} /> Clear {activeFilters}</button> : null}
          </>
        ) : (
          <label className="candidate-search candidate-search-wide"><Search size={17} /><span className="sr-only">Search committees</span><input type="search" placeholder="Committee name or FEC committee ID" value={committeeQuery} onChange={(event) => { setCommitteeQuery(event.target.value); setVisibleCount(INITIAL_DIRECTORY_ROWS) }} /></label>
        )}
        <div className="candidate-result-scope" aria-live="polite"><strong>{activeRows.length.toLocaleString()}</strong> records match · showing {Math.min(activeRows.length, visibleCount).toLocaleString()}</div>
      </section>

      {activeTab === "candidates" ? (
        <section id="candidates-panel" role="tabpanel" aria-labelledby="candidates-tab" className="candidate-directory">
          {candidateState === "loading" ? <DataState kind="setup" title="Loading candidate records" description="Requesting the current candidate directory from the local FEC-backed service." />
            : candidateState === "error" ? <DataState kind="error" title="Candidate directory unavailable" description={`${candidatesError}. This failed request is not presented as an empty list.`} action={<button type="button" onClick={() => void loadCandidates()}>Retry candidates</button>} />
              : candidateState === "empty" ? <DataState title="No candidates match these filters" description="Clear a filter or search another official candidate identifier." />
                : <div className="candidate-record-list">{filteredCandidates.slice(0, visibleCount).map((candidate, index) => (
                  <article className="candidate-record" key={candidate.candidate_id} style={{ "--row-index": Math.min(index, 7) } as React.CSSProperties}>
                    <div className={`candidate-record-mark ${partyClass(candidate.party)}`} aria-hidden="true">{candidate.name?.split(/\s+/).map((part) => part[0]).slice(0, 2).join("") || "?"}</div>
                    <div className="candidate-record-main"><div className="candidate-record-heading"><h2>{candidate.name || "Candidate name unavailable"}</h2>{candidate.incumbent ? <span className="archive-chip">Incumbent filing status</span> : null}</div><p>{officeLabel(candidate.office_sought)} · {candidate.state || "State unavailable"}{candidate.district ? ` district ${candidate.district}` : ""} · {candidate.party || "Party unavailable"}</p>{candidate.committee_name ? <small>Principal committee: {candidate.committee_name}</small> : null}</div>
                    <div className="candidate-record-id"><span>FEC candidate ID</span><strong>{candidate.candidate_id}</strong></div>
                    <div className="candidate-record-actions"><Link href={buildFecReceiptHref({ search: candidate.name || candidate.candidate_id })}>Search receipts <FileSearch size={14} /></Link><a href={`https://www.fec.gov/data/candidate/${encodeURIComponent(candidate.candidate_id)}/`} target="_blank" rel="noreferrer">FEC record <ExternalLink size={14} /></a></div>
                  </article>
                ))}</div>}
        </section>
      ) : (
        <section id="committees-panel" role="tabpanel" aria-labelledby="committees-tab" className="candidate-directory">
          {committeeState === "loading" ? <DataState kind="setup" title="Loading committee records" description="Requesting committee records independently from the candidate directory." />
            : committeeState === "error" ? <DataState kind="error" title="Committee directory unavailable" description={`${committeesError}. Candidate results remain independently available.`} action={<button type="button" onClick={() => void loadCommittees()}>Retry committees</button>} />
              : committeeState === "empty" ? <DataState title="No committees match this search" description="Search another committee name or official FEC identifier." />
                : <div className="candidate-record-list">{filteredCommittees.slice(0, visibleCount).map((committee, index) => (
                  <article className="candidate-record candidate-record-committee" key={committee.committee_id} style={{ "--row-index": Math.min(index, 7) } as React.CSSProperties}>
                    <div className="candidate-record-mark" aria-hidden="true"><Building2 size={20} /></div>
                    <div className="candidate-record-main"><h2>{committee.committee_name || "Committee name unavailable"}</h2><p>{committee.committee_type || "Type unavailable"} · {committee.state || "National or state unavailable"} · {committee.party || "Party unavailable"}</p>{committee.designation ? <small>Designation: {committee.designation}</small> : null}</div>
                    <div className="candidate-record-id"><span>FEC committee ID</span><strong>{committee.committee_id}</strong></div>
                    <div className="candidate-record-actions"><Link href={`/fec/receipts?committee=${encodeURIComponent(committee.committee_id)}`}>View receipts <FileSearch size={14} /></Link><a href={`https://www.fec.gov/data/committee/${encodeURIComponent(committee.committee_id)}/`} target="_blank" rel="noreferrer">FEC record <ExternalLink size={14} /></a></div>
                  </article>
                ))}</div>}
        </section>
      )}

      {activeRows.length > visibleCount ? <div className="candidate-load-more"><button type="button" onClick={() => setVisibleCount((count) => count + INITIAL_DIRECTORY_ROWS)}>Show {Math.min(INITIAL_DIRECTORY_ROWS, activeRows.length - visibleCount)} more records</button></div> : null}
    </ArchivePage>
  )
}
