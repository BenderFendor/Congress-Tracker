import { AlertTriangle } from "lucide-react";
import { ArchiveHero, ArchivePage, ArchivePanel } from "@/components/ui/archive-ui";

export default function NetWorthPage() {
  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Financial disclosures"
        title="Net worth"
        accent="Not yet published"
        description="Congressional disclosures report ranges and ownership categories; this product will not turn incomplete trade rows into net-worth estimates."
        mode="network"
      />
      <ArchivePanel title="Official disclosure ingestion required" kicker="Data quality guard">
        <div className="flex items-start gap-3 p-6 text-sm leading-6 text-muted-foreground">
          <AlertTriangle className="mt-1 shrink-0 text-accent" size={18} />
          <p>
            House Clerk and Senate eFD annual disclosures and periodic transaction reports are not
            yet normalized in the canonical database. The page will be enabled after those filings,
            owner types, ranges, and source links are available.
          </p>
        </div>
      </ArchivePanel>
    </ArchivePage>
  );
}
