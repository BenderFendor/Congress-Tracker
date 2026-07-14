import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4020";
    const res = await fetch(
      `${base}/api/organizations/${encodeURIComponent(params.id)}`,
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return { title: "Organization | Congress Tracker" };
    const data = await res.json();
    const name = data.name || params.id;
    return {
      title: `${name} | Congress Tracker`,
      description: `Organization details, relationships, and related records for ${name}.`,
      openGraph: {
        title: `${name} | Congress Tracker`,
        description: `Track organization records and relationships.`,
      },
    };
  } catch {
    return { title: "Organization | Congress Tracker" };
  }
}

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
