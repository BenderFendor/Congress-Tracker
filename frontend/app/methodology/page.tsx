import { Target, AlertTriangle, CheckCircle2, Award, Sliders } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* Header */}
        <div className="space-y-4 border-b border-border pb-8">
          <div className="flex items-center gap-2 text-accent">
            <Sliders className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-wider">Methodology & Resolution Engine</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Entity Resolution & Provenance Standards
          </h1>
          <p className="max-w-3xl text-lg text-muted-foreground leading-relaxed">
            To prevent misattribution across millions of disparate legislative, campaign finance, and trading records, CongressTracker implements deterministic entity resolution cascades, tiered confidence scoring, and first-class provenance envelopes.
          </p>
        </div>

        {/* Deterministic Entity Resolution Rules */}
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Deterministic Entity Resolution Cascade</h2>
              <p className="text-sm text-muted-foreground">Order of operations applied to crosswalk external records to canonical legislator profiles</p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              Module: entity_resolution.rs
            </Badge>
          </div>

          <div className="grid gap-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">01</span>
                    <CardTitle className="text-lg font-bold">Primary Key Match: Canonical Bioguide ID</CardTitle>
                  </div>
                  <Badge className="bg-green-600/15 text-green-700 dark:text-green-400 border-green-500/20">Confidence: 1.00 (Verified)</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground pl-14">
                When incoming source data (such as Congress.gov bill sponsorships or roll-call voting registries) provides an official alphanumeric Bioguide identifier (e.g., <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">A000360</code>), the engine performs an immediate primary key lookup against the <code className="font-mono text-foreground">members</code> table.
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">02</span>
                    <CardTitle className="text-lg font-bold">FEC Identifier Crosswalk</CardTitle>
                  </div>
                  <Badge className="bg-green-600/15 text-green-700 dark:text-green-400 border-green-500/20">Confidence: 1.00 (Verified)</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground pl-14">
                For campaign finance records from OpenFEC, the engine queries the <code className="font-mono text-foreground">member_identifiers</code> table where <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">scheme = &apos;fec&apos;</code>. This deterministically maps candidate IDs (such as <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">H8CA11084</code>) to their corresponding Bioguide entity without relying on name spelling.
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">03</span>
                    <CardTitle className="text-lg font-bold">ICPSR Identifier Crosswalk</CardTitle>
                  </div>
                  <Badge className="bg-green-600/15 text-green-700 dark:text-green-400 border-green-500/20">Confidence: 1.00 (Verified)</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground pl-14">
                To link DW-NOMINATE ideological positioning scores and historical roll-call datasets from Voteview, records are resolved via <code className="font-mono text-foreground">member_identifiers</code> where <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">scheme = &apos;icpsr&apos;</code>.
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 font-mono text-xs font-bold text-amber-600 dark:text-amber-400">04</span>
                    <CardTitle className="text-lg font-bold">Normalized Full Name + State + Chamber + Term Overlap</CardTitle>
                  </div>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">Confidence: 0.85 (High Heuristic)</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground pl-14">
                When records lack stable unique identifiers (such as stock disclosures or unstructured state filings), strings undergo strict normalization (diacritics stripped, suffixes parsed, lowercased). A match is established if the normalized name matches exactly AND coincides with candidate state, congressional chamber, and active service date boundaries.
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/10 font-mono text-xs font-bold text-orange-600 dark:text-orange-400">05</span>
                    <CardTitle className="text-lg font-bold">Normalized Full Name + State (Chamber or Dates Missing)</CardTitle>
                  </div>
                  <Badge variant="outline" className="border-orange-500/30 text-orange-600 dark:text-orange-400">Confidence: 0.65 (Quarantine Queue)</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground pl-14 space-y-2">
                <p>
                  If chamber or term overlap cannot be confirmed, exact name and state matches yield a confidence score of 0.65.
                </p>
                <p className="font-semibold text-foreground">
                  Safeguard Rule: Records resolved at confidence &lt; 0.85 are NEVER automatically attached to member financial totals or public profile aggregates. Instead, they are quarantined in the <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs font-normal">entity_resolution_queue</code> table for manual human verification.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Confidence Scoring Tiers */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Confidence Scoring Tiers & Enforcement</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                  <Award className="h-5 w-5" />
                  <CardTitle className="text-lg font-bold">Tier 1: Verified (1.00)</CardTitle>
                </div>
                <CardDescription>Cryptographic or official identifier match</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Assigned exclusively to records joined via stable primary keys (<code className="font-mono">bioguide_id</code>, <code className="font-mono">fec</code> candidate ID, or <code className="font-mono">icpsr</code> ID).
                </p>
                <p className="border-t border-border pt-2 font-medium text-foreground">
                  Usage: Directly populates member profile heroes, roll-call voting tables, campaign finance totals, and official legislative history.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                  <Target className="h-5 w-5" />
                  <CardTitle className="text-lg font-bold">Tier 2: High Heuristic (0.85)</CardTitle>
                </div>
                <CardDescription>Multi-factor biographical overlap</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Assigned when exact normalized string matching corroborates state, chamber, and service window boundaries.
                </p>
                <p className="border-t border-border pt-2 font-medium text-foreground">
                  Usage: Displayed in secondary analytical panels (e.g., stock disclosures or lobbying correlation overlays) with prominent visual confidence indicators.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
                  <AlertTriangle className="h-5 w-5" />
                  <CardTitle className="text-lg font-bold">Tier 3: Low / Quarantine (&le; 0.65)</CardTitle>
                </div>
                <CardDescription>Ambiguous or partial string matches</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Assigned when partial name matches lack chamber or date corroboration, or when common names create ambiguity across multiple politicians.
                </p>
                <p className="border-t border-border pt-2 font-medium text-foreground">
                  Usage: Blocked from public API aggregation. Held in administrative resolution queues awaiting manual audit and sign-off.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* First-Class Source Provenance Model */}
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">First-Class Source Provenance Envelopes</h2>
              <p className="text-sm text-muted-foreground">Every API response embeds audit trails explaining origins and missing data</p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              Contract: ProvenanceSummary
            </Badge>
          </div>

          <Card className="border-border bg-card">
            <CardContent className="pt-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-foreground">Transparent Audit Payloads</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Rather than presenting opaque numbers or silent zeros when upstream data is missing, every endpoint served by <code className="font-mono text-foreground">intel_backend</code> attaches a structured <code className="font-mono text-foreground">provenance</code> envelope.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span><strong>Source Tracking:</strong> Lists exact upstream data providers, sync status, and fetch timestamps.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span><strong>Confidence Tagging:</strong> Explicitly reports the resolution confidence tier governing the payload.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span><strong>Structured Warnings:</strong> Returns standardized error codes when fields are unavailable (e.g., <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">next_election_unavailable_missing_terms</code>), preventing silent display distortion.</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs text-foreground overflow-x-auto space-y-2">
                  <div className="text-muted-foreground">{'// Example API Response Envelope'}</div>
                  <pre className="text-[11px] leading-relaxed">{`{
  "bioguide_id": "A000360",
  "official_full_name": "Mark Amodei",
  "next_election": "2026-11-03",
  "provenance": {
    "sources": [
      {
        "source": "unitedstates_legislators",
        "status": "success",
        "fetched_at": "2026-07-03T04:12:00Z",
        "confidence": "verified"
      },
      {
        "source": "openfec",
        "status": "success",
        "fetched_at": "2026-07-03T02:00:00Z",
        "confidence": "verified"
      }
    ],
    "warnings": []
  }
}`}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
