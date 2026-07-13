"use client"

import { useEffect, useState } from "react"
import { Shield, ExternalLink, Clock, Lock, Layers } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArchivePage, DataState } from "@/components/ui/archive-ui"
import { CompactMasthead } from "@/components/ui/mockup-visuals"

interface SourceRunRecord {
  id?: string
  source: string
  endpoint?: string
  status?: string | null
  freshness?: string
  fetched_at?: string
  started_at?: string
  finished_at?: string
  rows_seen?: number
  rows_written?: number
  error_message?: string
}

export default function DataSourcesPage() {
  const [sourceRuns, setSourceRuns] = useState<SourceRunRecord[]>([])
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [sourceRunsError, setSourceRunsError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSourceRuns() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4020"}/api/sources/status`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            setSourceRuns(data)
          } else if (data && Array.isArray(data.runs)) {
            setSourceRuns(data.runs)
          }
        } else {
          setSourceRunsError(`Freshness request failed (${res.status})`)
        }
      } catch (error) {
        setSourceRunsError(error instanceof Error ? error.message : "Freshness request failed")
      } finally {
        setLoadingRuns(false)
      }
    }
    fetchSourceRuns()
  }, [])

  const dataSources = [
    {
      name: "Congress.gov API",
      type: "Official Legislative API",
      license: "Public Domain / US Government Work",
      url: "https://api.congress.gov/",
      sourceKey: "congress_gov",
      badgeVariant: "default" as const,
      description: "Library of Congress official legislative API providing bills, amendments, summaries, actions, cosponsors, and member committee assignments.",
      updateRate: "Real-time / Daily",
    },
    {
      name: "OpenFEC API",
      type: "Official Campaign Finance API",
      license: "Public Domain / Official Records",
      url: "https://api.open.fec.gov/",
      sourceKey: "openfec",
      badgeVariant: "default" as const,
      description: "Federal Election Commission official API providing candidate filings, principal campaign committees, Schedule A receipts, Schedule B disbursements, and Schedule E independent expenditures.",
      updateRate: "Nightly / Daily Cycles",
    },
    {
      name: "Senate Lobbying Disclosure (LDA)",
      type: "Official Lobbying API",
      license: "Public Access / Government Records",
      url: "https://lda.gov/api",
      sourceKey: "lda",
      badgeVariant: "default" as const,
      description: "Official lobbying disclosure filings (LD-1, LD-2, LD-203) detailing registrants, clients, reported lobbying income, expenses, issue codes, and contacted government entities.",
      updateRate: "Quarterly Filings",
    },
    {
      name: "UnitedStates Congressional Legislators",
      type: "Community / Public Repository",
      license: "CC0 1.0 Universal / Public Domain",
      url: "https://github.com/unitedstates/congress-legislators",
      sourceKey: "unitedstates_legislators",
      badgeVariant: "secondary" as const,
      description: "Comprehensive historical and current legislator terms, biographical data, social media handles, district office addresses, and crosswalk IDs (Bioguide, FEC, ICPSR, Wikidata).",
      updateRate: "Continuous GitHub Pipeline",
    },
    {
      name: "Voteview Roll Call & Ideology Data",
      type: "Academic Dataset",
      license: "Open Access / Academic Citation",
      url: "https://voteview.com/data",
      sourceKey: "voteview",
      badgeVariant: "secondary" as const,
      description: "Congressional roll-call voting datasets and DW-NOMINATE ideological positioning dimensions (Economic/Redistributive Dim 1 and Social/Racial Dim 2) maintained by UCLA.",
      updateRate: "Bi-weekly / After Votes",
    },
    {
      name: "CapitolTrades",
      type: "Financial Disclosures Aggregation",
      license: "Public Access / Fair Use",
      url: "https://www.capitoltrades.com/",
      sourceKey: "capitoltrades",
      badgeVariant: "outline" as const,
      description: "Structured congressional STOCK Act disclosures detailing politician stock trades, transaction types, asset tickers, disclosure intervals, and estimated value bands.",
      updateRate: "Continuous Monitoring",
    },
    {
      name: "CIVIQ Enrichment Layer",
      type: "Civic Intelligence Service",
      license: "Open Access",
      url: "https://github.com/",
      sourceKey: "civiq",
      badgeVariant: "outline" as const,
      description: "Enriched legislator metadata including tenure duration, next election timeline calculations, committee ranking, and district demographics.",
      updateRate: "Periodic Releases",
    },
    {
      name: "Wikidata Congressional Crosswalks",
      type: "Open Knowledge Graph",
      license: "CC0 1.0 Universal",
      url: "https://www.wikidata.org/",
      sourceKey: "wikidata",
      badgeVariant: "secondary" as const,
      description: "Global open knowledge graph providing entity resolution crosswalks linking biographical entries, official roles, and institutional identifiers.",
      updateRate: "Community Maintained",
    },
    {
      name: "Curated Influence Network Seeds",
      type: "Verified Public Entity Seeds",
      license: "Public Domain / OpenFEC Citations",
      url: "https://www.fec.gov/",
      sourceKey: "manual_influence_seed",
      badgeVariant: "default" as const,
      description: "Verified public FEC committee identifiers mapping major advocacy networks (including AIPAC PAC C00797670, UDP C00799031, and DMFI C90022864) to direct spending pipelines.",
      updateRate: "Curated Verification",
    },
  ]

  const getRunStatusForSource = (key: string) => {
    const match = sourceRuns.find((r) => r.source === key || r.source.toLowerCase().includes(key.toLowerCase()))
    return match
  }

  return (
    <ArchivePage>
      <div className="editorial-reference-page">
        <CompactMasthead
          eyebrow="System architecture / source register"
          title="Data sources &"
          accent="freshness."
          description="A public register of the official, academic, and community records behind CongressTracker, with live pipeline state kept separate from source coverage."
        />
        <div className="editorial-reference-content">

        {/* Postgres-Backed Source Freshness */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl font-bold">PostgreSQL Source Freshness Monitor</CardTitle>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                Table: source_runs
              </Badge>
            </div>
            <CardDescription>
              Real-time ingestion pipelines track execution history, row volumes, and API rate limits directly in our canonical database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRuns ? (
              <DataState title="Checking pipeline freshness" description="Requesting the latest canonical source-run records." />
            ) : sourceRunsError ? (
              <DataState kind="error" title="Pipeline freshness unavailable" description={`${sourceRunsError}. The source catalog remains available, but no live run status is inferred.`} />
            ) : sourceRuns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-3 font-semibold">Source Identifier</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Rows Processed</th>
                      <th className="pb-3 font-semibold">Last Execution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sourceRuns.map((run, idx) => (
                      <tr key={run.id || idx} className="py-3">
                        <td className="py-3 font-mono font-medium text-foreground">{run.source}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            (run.status || run.freshness) === "success" || run.freshness === "fresh" ? "bg-green-500/10 text-green-700 dark:text-green-400" :
                            run.status === "running" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400" :
                            run.status === "partial" || run.freshness === "stale" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                            "bg-red-500/10 text-red-700 dark:text-red-400"
                          }`}>
                            {(run.status || run.freshness || "missing").toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {run.rows_written != null ? `${run.rows_written} written` : run.rows_seen != null ? `${run.rows_seen} seen` : "Not loaded"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {run.fetched_at ? new Date(run.fetched_at).toLocaleString() : run.finished_at ? new Date(run.finished_at).toLocaleString() : run.started_at ? new Date(run.started_at).toLocaleString() : "Not loaded"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Canonical PostgreSQL pipeline ingestion is managed by automated scheduled workers. Run <code className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">cargo run -p intel_backend --bin ingest -- all-smoke</code> from the terminal to populate live execution metadata.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unified Data Sources Catalog */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Catalog of Integrated Datasets</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {dataSources.map((source) => {
              const runInfo = getRunStatusForSource(source.sourceKey)
              return (
                <Card key={source.name} className="flex flex-col justify-between border-border bg-card transition-all hover:border-border/80">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-bold text-foreground">{source.name}</CardTitle>
                        <div className="text-xs font-medium text-muted-foreground">{source.type}</div>
                      </div>
                      <Badge variant={source.badgeVariant} className="shrink-0 text-xs">
                        {source.license.split("/")[0].trim()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{source.description}</p>
                    <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{source.updateRate}</span>
                        {runInfo && (
                          <span className="ml-1 rounded bg-muted px-1.5 py-0.2 font-mono text-[10px]">
                            {runInfo.status}
                          </span>
                        )}
                      </div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        Source Access <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Critical Methodological Rules & Distinctions */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Methodological Accounting & Attribution Rules</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Direct PAC vs IE */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center gap-2.5 text-primary mb-1">
                  <Shield className="h-5 w-5" />
                  <CardTitle className="text-base font-bold">Direct PAC vs. Independent Expenditures</CardTitle>
                </div>
                <CardDescription>Strict legal separation of campaign finances</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Federal election law strictly distinguishes between direct candidate campaign contributions and independent outside spending.
                </p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>
                    <strong className="text-foreground">Direct PAC Contributions (Schedule A):</strong> Direct money given to a candidate campaign or authorized leadership PAC. Subject to statutory contribution caps ($5,000 per election per PAC).
                  </li>
                  <li>
                    <strong className="text-foreground">Independent Expenditures (Schedule E):</strong> Spending by Super PACs or outside committees supporting or opposing a candidate. By law, these funds <em className="text-foreground">cannot be coordinated</em> with candidate campaigns.
                  </li>
                </ul>
                <p className="border-t border-border pt-2 font-medium text-foreground">
                  Rule: Independent expenditures are NEVER summed into a candidate campaign receipt totals. They are displayed as distinct external advocacy metrics.
                </p>
              </CardContent>
            </Card>

            {/* Heuristic Lobbying Matches */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center gap-2.5 text-primary mb-1">
                  <Layers className="h-5 w-5" />
                  <CardTitle className="text-base font-bold">Heuristic Lobbying Attribution</CardTitle>
                </div>
                <CardDescription>Correlating legislative topics to disclosures</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Senate LDA disclosure filings report broad quarterly activities under standardized 3-letter issue codes (e.g., TAX, HCR, DEF) along with free-text descriptions of lobbying focus.
                </p>
                <p>
                  When a filing explicitly names a bill number (e.g., &quot;H.R. 1&quot; or &quot;S. 500&quot;), our resolution engine links the filing directly to that bill record.
                </p>
                <p>
                  When specific bill numbers are omitted, our intelligence pipeline performs case-insensitive keyword and subject matching between bill policy areas and lobbying text descriptions.
                </p>
                <p className="border-t border-border pt-2 font-medium text-foreground">
                  Rule: All keyword-derived correlations are explicitly tagged with <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">confidence: &apos;heuristic&apos;</code> to distinguish them from direct statutory citations.
                </p>
              </CardContent>
            </Card>

            {/* Dark Money / 501(c)(4) */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 mb-1">
                  <Lock className="h-5 w-5" />
                  <CardTitle className="text-base font-bold">Dark-Money &amp; 501(c)(4) Unknowns</CardTitle>
                </div>
                <CardDescription>Tracing limits of opaque political spending</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Under 26 U.S.C. § 501(c)(4), social welfare organizations and industry trade associations can participate in political advocacy and make unlimited transfers to Super PACs without disclosing their underlying individual donors to the FEC.
                </p>
                <p>
                  Consequently, when a Super PAC reports receiving funds from a 501(c)(4) advocacy organization, public government disclosure records end at the organizational level.
                </p>
                <p className="border-t border-border pt-2 font-medium text-foreground">
                  Rule: We attribute spending only to verified public FEC committee entities. Opaque donor pools behind 501(c)(4) vehicles are explicitly labeled as <span className="underline">undisclosed / untraceable</span> under current federal statutory law.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </div>
    </ArchivePage>
  )
}
