import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4020";
    const res = await fetch(
      `${base}/api/bills/${encodeURIComponent(params.id)}`,
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return { title: "Bill | Congress Tracker" };
    const data = await res.json();
    const title = data.title || data.bill_number || params.id;
    return {
      title: `${title} | Congress Tracker`,
      description: `Bill details, sponsors, amendments, and related records for ${title}.`,
      openGraph: {
        title: `${title} | Congress Tracker`,
        description: `Track bill details and related records.`,
      },
    };
  } catch {
    return { title: "Bill | Congress Tracker" };
  }
}

export default function BillLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
