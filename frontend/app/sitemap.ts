import type { MetadataRoute } from "next";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4020";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

// Cap per-type entries so the sitemap stays a reasonable size while still
// surfacing a representative slice of each dossier type to crawlers.
const DOSSIER_LIMIT = 300;

const STATIC_ROUTES = [
  "",
  "/legislators",
  "/bills",
  "/committees",
  "/candidates",
  "/elections",
  "/influence",
  "/lobbying",
  "/networth",
  "/portfolio",
  "/search",
  "/visualizations",
  "/data-sources",
  "/methodology",
  "/api-docs",
  "/about/data",
  "/fec/receipts",
  "/fec/disbursements",
];

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Backend unreachable at build/request time — degrade to static routes only.
    return null;
  }
}

async function legislatorEntries(): Promise<MetadataRoute.Sitemap> {
  const members = await fetchJson<Array<{ bioguide_id?: string }>>(
    `/api/legislators?limit=${DOSSIER_LIMIT}`,
  );
  if (!members) return [];
  return members
    .filter((m): m is { bioguide_id: string } => Boolean(m.bioguide_id))
    .map((m) => ({
      url: `${SITE_URL}/legislators/${encodeURIComponent(m.bioguide_id)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
}

async function billEntries(): Promise<MetadataRoute.Sitemap> {
  const data = await fetchJson<{ bills?: Array<{ bill_id?: string }> }>(
    `/api/bills?limit=${DOSSIER_LIMIT}`,
  );
  if (!data?.bills) return [];
  return data.bills
    .filter((b): b is { bill_id: string } => Boolean(b.bill_id))
    .map((b) => ({
      url: `${SITE_URL}/bills/${encodeURIComponent(b.bill_id)}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
}

async function committeeEntries(): Promise<MetadataRoute.Sitemap> {
  const committees = await fetchJson<Array<{ committee_id?: string }>>(
    `/api/committees?limit=${DOSSIER_LIMIT}`,
  );
  if (!committees) return [];
  return committees
    .filter((c): c is { committee_id: string } => Boolean(c.committee_id))
    .map((c) => ({
      url: `${SITE_URL}/committees/${encodeURIComponent(c.committee_id)}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
}

async function organizationEntries(): Promise<MetadataRoute.Sitemap> {
  // There is no dedicated organizations list endpoint. FEC committee ids
  // resolve at /api/organizations/{id} (organization_identifiers scheme
  // "fec"), so /api/intel/fec/committees is the closest sensible list.
  const committees = await fetchJson<Array<{ committee_id?: string }>>(
    `/api/intel/fec/committees?limit=${DOSSIER_LIMIT}`,
  );
  if (!committees) return [];
  return committees
    .filter((c): c is { committee_id: string } => Boolean(c.committee_id))
    .map((c) => ({
      url: `${SITE_URL}/organizations/${encodeURIComponent(c.committee_id)}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: "daily" as const,
    priority: route === "" ? 1 : 0.8,
  }));

  const [legislators, bills, committees, organizations] = await Promise.all([
    legislatorEntries(),
    billEntries(),
    committeeEntries(),
    organizationEntries(),
  ]);

  return [...staticEntries, ...legislators, ...bills, ...committees, ...organizations];
}
