import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ArchiveHero, ArchivePage, ArchivePanel } from "@/components/ui/archive-ui";

export default function OrganizationProfilePage() {
  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Lobbying organization"
        title="Organization profile"
        accent="Not yet published"
        description="Organization dossiers require canonical registrant, client, and filing relationships before they can be shown accurately."
        mode="network"
      />
      <ArchivePanel title="Canonical registrant data required" kicker="Data quality guard">
        <div className="flex items-start gap-3 p-6 text-sm leading-6 text-muted-foreground">
          <AlertTriangle className="mt-1 shrink-0 text-accent" size={18} />
          <p>
            The current backend exposes filing records but not a complete registrant/client detail
            contract. Browse the sourced filing list while the organization relationship endpoint is
            implemented.
          </p>
        </div>
        <div className="px-6 pb-6">
          <Link href="/lobbying" className="text-sm font-semibold text-accent hover:underline">
            Return to lobbying filings
          </Link>
        </div>
      </ArchivePanel>
    </ArchivePage>
  );
}
