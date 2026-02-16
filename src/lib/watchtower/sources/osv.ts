import { Advisory } from "../types";

interface OSVVulnerability {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  severity?: Array<{ type: string; score: string }>;
  database_specific?: { severity?: string };
  affected?: Array<{
    package?: { name: string; ecosystem: string };
    ranges?: Array<{
      type: string;
      events: Array<{ introduced?: string; fixed?: string }>;
    }>;
  }>;
  references?: Array<{ type: string; url: string }>;
  published?: string;
}

function mapSeverity(vuln: OSVVulnerability): Advisory["severity"] {
  // Check database_specific.severity first
  const dbSeverity = vuln.database_specific?.severity?.toLowerCase();
  if (dbSeverity === "critical" || dbSeverity === "high" || dbSeverity === "medium" || dbSeverity === "low") {
    return dbSeverity;
  }

  // Check CVSS severity array
  if (vuln.severity && vuln.severity.length > 0) {
    const cvss = vuln.severity[0];
    if (cvss.type === "CVSS_V3" && cvss.score) {
      const score = parseFloat(cvss.score);
      if (score >= 9.0) return "critical";
      if (score >= 7.0) return "high";
      if (score >= 4.0) return "medium";
      return "low";
    }
  }

  return "unknown";
}

function extractCveId(vuln: OSVVulnerability): string | undefined {
  return vuln.aliases?.find((a) => a.startsWith("CVE-"));
}

function extractFixedVersion(vuln: OSVVulnerability): string | undefined {
  const affected = vuln.affected?.[0];
  if (!affected?.ranges) return undefined;

  for (const range of affected.ranges) {
    for (const event of range.events) {
      if (event.fixed) return event.fixed;
    }
  }
  return undefined;
}

function extractVersionRange(vuln: OSVVulnerability): string | undefined {
  const affected = vuln.affected?.[0];
  if (!affected?.ranges) return undefined;

  for (const range of affected.ranges) {
    let introduced: string | undefined;
    let fixed: string | undefined;
    for (const event of range.events) {
      if (event.introduced) introduced = event.introduced;
      if (event.fixed) fixed = event.fixed;
    }
    if (introduced && fixed) return `>=${introduced} <${fixed}`;
    if (introduced) return `>=${introduced}`;
  }
  return undefined;
}

export async function queryOSV(
  pkg: string,
  version: string,
  ecosystem: string
): Promise<Advisory[]> {
  console.log(`[watchtower] OSV: querying ${ecosystem}/${pkg}@${version}`);

  const response = await fetch("https://api.osv.dev/v1/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      package: { name: pkg, ecosystem },
      version,
    }),
  });

  if (!response.ok) {
    console.log(`[watchtower] OSV: query failed for ${pkg} (${response.status})`);
    return [];
  }

  const data = await response.json();
  const vulns: OSVVulnerability[] = data.vulns ?? [];

  return vulns.map((vuln) => {
    const refUrl = vuln.references?.find((r) => r.type === "WEB" || r.type === "ADVISORY")?.url;

    return {
      id: vuln.id,
      source: "osv" as const,
      title: vuln.summary ?? vuln.id,
      description: vuln.details ?? "",
      severity: mapSeverity(vuln),
      cveId: extractCveId(vuln),
      affectedPackage: pkg,
      affectedVersionRange: extractVersionRange(vuln),
      fixedVersion: extractFixedVersion(vuln),
      url: refUrl ?? `https://osv.dev/vulnerability/${vuln.id}`,
      publishedAt: vuln.published ? new Date(vuln.published) : new Date(),
    };
  });
}
