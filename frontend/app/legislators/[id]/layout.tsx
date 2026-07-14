import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4020";
    const res = await fetch(
      `${base}/api/legislators/${encodeURIComponent(params.id)}`,
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return { title: "Legislator | Congress Tracker" };
    const data = await res.json();
    const name = data.display_name || data.full_name || params.id;
    const state = data.state || "";
    const party = data.party || "";
    return {
      title: `${name} (${party}-${state}) | Congress Tracker`,
      description: `Voting record, campaign finance, financial disclosures, and legislation for ${name}.`,
      openGraph: {
        title: `${name} | Congress Tracker`,
        description: `Track votes, funding, and disclosures for ${name}.`,
      },
    };
  } catch {
    return { title: "Legislator | Congress Tracker" };
  }
}

export default function LegislatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
