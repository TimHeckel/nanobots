import { Advisory } from "../types";

interface KEVEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  knownRansomwareCampaignUse: string;
}

export async function fetchCISAKEV(): Promise<Advisory[]> {
  console.log("[watchtower] CISA KEV: fetching known exploited vulnerabilities");

  const response = await fetch(
    "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
  );

  if (!response.ok) {
    console.log(`[watchtower] CISA KEV: fetch failed (${response.status})`);
    return [];
  }

  const data = await response.json();
  const entries: KEVEntry[] = data.vulnerabilities ?? [];

  const advisories: Advisory[] = entries.map((entry) => ({
    id: `kev-${entry.cveID}`,
    source: "cisa-kev" as const,
    title: entry.vulnerabilityName,
    description: entry.shortDescription,
    severity: "critical",
    cveId: entry.cveID,
    affectedPackage: `${entry.vendorProject}/${entry.product}`.toLowerCase(),
    url: `https://nvd.nist.gov/vuln/detail/${entry.cveID}`,
    publishedAt: new Date(entry.dateAdded),
  }));

  console.log(`[watchtower] CISA KEV: loaded ${advisories.length} entries`);
  return advisories;
}
