import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4020";
    const res = await fetch(
      `${base}/api/committees/${encodeURIComponent(params.id)}`,
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return { title: "Committee | Congress Tracker" };
    const data = await res.json();
    const name = data.name || params.id;
    return {
      title: `${name} | Congress Tracker`,
      description: `Committee members, jurisdiction, bills, and related records for ${name}.`,
      openGraph: {
        title: `${name} | Congress Tracker`,
        description: `Track committee activity and membership.`,
      },
    };
  } catch {
    return { title: "Committee | Congress Tracker" };
  }
}

export default function CommitteeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
