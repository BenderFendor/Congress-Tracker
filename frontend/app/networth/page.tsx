import { ArchiveHero, ArchiveMetrics, ArchivePage, DataState, EvidenceSpine } from "@/components/ui/archive-ui"
import { getFinancialSnapshots } from "@/lib/services/financial"
import { Calculator, CalendarRange, FileWarning, Scale } from "lucide-react"

import { NetWorthDirectory } from "./_components/net-worth-directory"

export default async function NetWorthPage() {
  let response
  try {
    response = await getFinancialSnapshots()
  } catch {
    response = null
  }
  const years = response ? [...new Set(response.snapshots.map((snapshot) => snapshot.reporting_year))] : []
  const incompleteRanges = response?.snapshots.filter((snapshot) => snapshot.lower_bound_unavailable || snapshot.upper_bound_unavailable).length ?? 0
  const residenceCaveats = response?.snapshots.filter((snapshot) => snapshot.personal_residence_unavailable).length ?? 0

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Annual financial disclosures"
        title="Net-worth"
        accent="snapshots"
        description="Compare conservative ranges calculated from reported asset and liability brackets. Open-ended values remain open-ended, and missing residence values remain explicit."
        mode="network"
        aside={(
          <EvidenceSpine
            source="House and Senate annual disclosure records"
            status={!response ? "Snapshot service unavailable" : response.coverage === "loaded" ? "Calculated records loaded" : "Awaiting filing ingestion"}
            coverage={response ? `${response.snapshots.length.toLocaleString()} calculated snapshots` : "Coverage cannot be evaluated"}
          >
            <p className="text-sm leading-6 text-muted-foreground">These are disclosure-range calculations, not appraisals. Values can omit exempt or unavailable property and should not be presented as exact wealth.</p>
          </EvidenceSpine>
        )}
      />
      <ArchiveMetrics metrics={[
        { label: "Snapshots", value: !response ? "Unavailable" : response.snapshots.length, detail: "Loaded calculation rows", icon: <Calculator size={19} /> },
        { label: "Filing years", value: !response ? "Unavailable" : years.length, detail: years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "No loaded years", icon: <CalendarRange size={19} /> },
        { label: "Open bounds", value: !response ? "Unavailable" : incompleteRanges, detail: "Not converted to zero", icon: <Scale size={19} /> },
        { label: "Residence caveats", value: !response ? "Unavailable" : residenceCaveats, detail: "Explicitly excluded values", icon: <FileWarning size={19} /> },
      ]} />
      {!response ? <div className="archive-content"><DataState kind="error" title="Snapshot service unavailable" description="The backend did not return a financial snapshot response. Coverage cannot be inferred, so the page does not show a zero-record result." /></div>
        : response.snapshots.length === 0 ? <div className="archive-content"><DataState kind="setup" title="Official disclosure ingestion required" description="No annual disclosure snapshots are loaded. This is a coverage gap, not evidence that members have no assets or liabilities." /></div>
          : <NetWorthDirectory snapshots={response.snapshots} />}
    </ArchivePage>
  )
}
