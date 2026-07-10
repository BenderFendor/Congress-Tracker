import { ArchiveHero, ArchivePage, ArchivePanel } from "@/components/ui/archive-ui";

export default function VisualizationsPage() {
  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Evidence workspace"
        title="Visualizations"
        accent="In progress"
        description="Charts will be enabled when their underlying canonical records are available."
        mode="network"
      />
      <ArchivePanel title="No derived charts published" kicker="Data quality guard">
        <p className="p-6 text-sm leading-6 text-muted-foreground">
          This route no longer renders archived CSV fixtures or estimated relationship values.
          Use the member, bill, committee, influence, and lobbying pages for sourced records while
          the canonical aggregation endpoints are being completed.
        </p>
      </ArchivePanel>
    </ArchivePage>
  );
}
