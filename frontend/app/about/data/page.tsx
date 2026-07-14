import { ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArchivePage } from "@/components/ui/archive-ui"
import { CompactMasthead } from "@/components/ui/mockup-visuals"

interface DataSource {
  name: string
  url: string
  usage: string
  terms: string
}

const dataSources: DataSource[] = [
  {
    name: "Federal Election Commission (FEC)",
    url: "https://www.fec.gov/",
    usage: "Campaign finance filings, candidate disbursements, Schedule A receipts, Schedule B expenditures, and independent expenditure data via the OpenFEC API.",
    terms: "Public domain. FEC records are official government data not subject to copyright. Attribution to the Federal Election Commission is customary.",
  },
  {
    name: "House Clerk",
    url: "https://clerk.house.gov/",
    usage: "Official House of Representatives disclosures including member financial filings, travel reports, and gift disclosures.",
    terms: "Public domain. Records of the Office of the Clerk are U.S. government works. Attribution: Office of the Clerk, U.S. House of Representatives.",
  },
  {
    name: "Senate eFD",
    url: "https://efd.senate.gov/",
    usage: "Senate electronic financial disclosure filings including periodic transaction reports (PTRs), annual reports, and candidate reports filed under the STOCK Act.",
    terms: "Public domain. Senate public records available under the Ethics in Government Act. Attribution: U.S. Senate Financial Disclosures.",
  },
  {
    name: "Lobbying Disclosure Act (LDA)",
    url: "https://lda.gov/",
    usage: "Quarterly lobbying disclosure filings (LD-1, LD-2, LD-203) detailing registrants, clients, lobbying income ranges, expenses, issue codes, and contacted government entities.",
    terms: "Public access. LDA filings are mandatory public disclosures made available through the House and Senate. Attribution: Lobbying Disclosure Act Database.",
  },
  {
    name: "Congress.gov",
    url: "https://congress.gov/",
    usage: "Bills, amendments, legislative actions, cosponsors, committee assignments, and floor schedules maintained by the Library of Congress.",
    terms: "Public domain. Library of Congress data is a U.S. government work. Attribution: Congress.gov, Library of Congress.",
  },
  {
    name: "Voteview",
    url: "https://voteview.com/",
    usage: "DW-NOMINATE ideological positioning scores (Dim 1 economic/redistributive and Dim 2 social/racial dimensions) and historical congressional roll-call voting datasets.",
    terms: "Open access. Voteview data is available for academic and research use with attribution. Citation: Lewis, Jeffrey B., et al. Voteview: Congressional Roll-Call Votes Database.",
  },
  {
    name: "TIGERweb",
    url: "https://tigerweb.geo.census.gov/",
    usage: "Geographic boundary data for congressional districts, state legislative districts, and census geographies used to render election and district maps.",
    terms: "Public domain. U.S. Census Bureau TIGER/Line shapefiles and TIGERweb services. Attribution: U.S. Census Bureau.",
  },
  {
    name: "Bioguide",
    url: "https://bioguide.congress.gov/",
    usage: "Biographical Directory of the United States Congress providing canonical member identifiers (bioguide_id), portrait images, and official biographical entries.",
    terms: "Public domain. Maintained by the Library of Congress as an official U.S. government resource. Attribution: Biographical Directory of the U.S. Congress.",
  },
]

export default function DataAttributionPage() {
  return (
    <ArchivePage>
      <div className="editorial-reference-page">
        <CompactMasthead
          eyebrow="Attribution / upstream data register"
          title="Data Sources &"
          accent="Attribution."
          description="A public accounting of the official and academic records that power CongressTracker, with usage scope and licensing terms for each upstream provider."
        />
        <div className="editorial-reference-content">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Upstream Data Providers
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {dataSources.map((source) => (
                <Card
                  key={source.name}
                  className="flex flex-col justify-between border-border bg-card transition-all hover:border-border/80"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg font-bold text-foreground">
                        {source.name}
                      </CardTitle>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        Public Domain
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <CardDescription className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Data Used
                      </CardDescription>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {source.usage}
                      </p>
                    </div>
                    <div>
                      <CardDescription className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Terms &amp; Attribution
                      </CardDescription>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {source.terms}
                      </p>
                    </div>
                    <div className="border-t border-border/60 pt-4">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        {source.url.replace(/^https?:\/\//, "")}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ArchivePage>
  )
}
