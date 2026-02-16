import { Octokit } from "@octokit/rest";
import { Advisory } from "../types";

const ECOSYSTEM_MAP: Record<string, string> = {
  npm: "NPM",
  pypi: "PIP",
  go: "GO",
  rubygems: "RUBYGEMS",
};

interface GHAdvisoryNode {
  ghsaId: string;
  summary: string;
  description: string;
  severity: string;
  permalink: string;
  publishedAt: string;
  vulnerabilities: {
    nodes: Array<{
      package: { name: string; ecosystem: string };
      vulnerableVersionRange: string;
      firstPatchedVersion: { identifier: string } | null;
    }>;
  };
}

function mapSeverity(severity: string): Advisory["severity"] {
  const s = severity.toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low") return s;
  return "unknown";
}

export async function queryGitHubAdvisories(
  ecosystem: string,
  octokit: Octokit
): Promise<Advisory[]> {
  const ghEcosystem = ECOSYSTEM_MAP[ecosystem];
  if (!ghEcosystem) {
    console.log(`[watchtower] GitHub Advisory: unknown ecosystem ${ecosystem}`);
    return [];
  }

  console.log(`[watchtower] GitHub Advisory: querying ${ghEcosystem}`);

  const query = `
    query($ecosystem: SecurityAdvisoryEcosystem!) {
      securityAdvisories(
        first: 20,
        orderBy: { field: PUBLISHED_AT, direction: DESC },
        ecosystem: $ecosystem
      ) {
        nodes {
          ghsaId
          summary
          description
          severity
          permalink
          publishedAt
          vulnerabilities(first: 5) {
            nodes {
              package {
                name
                ecosystem
              }
              vulnerableVersionRange
              firstPatchedVersion {
                identifier
              }
            }
          }
        }
      }
    }
  `;

  try {
    const data: { securityAdvisories: { nodes: GHAdvisoryNode[] } } =
      await octokit.graphql(query, { ecosystem: ghEcosystem });

    const advisories: Advisory[] = [];

    for (const node of data.securityAdvisories.nodes) {
      for (const vuln of node.vulnerabilities.nodes) {
        advisories.push({
          id: node.ghsaId,
          source: "github",
          title: node.summary,
          description: node.description,
          severity: mapSeverity(node.severity),
          affectedPackage: vuln.package.name,
          affectedVersionRange: vuln.vulnerableVersionRange || undefined,
          fixedVersion: vuln.firstPatchedVersion?.identifier,
          url: node.permalink,
          publishedAt: new Date(node.publishedAt),
        });
      }
    }

    console.log(`[watchtower] GitHub Advisory: found ${advisories.length} advisories for ${ghEcosystem}`);
    return advisories;
  } catch (err) {
    console.error(`[watchtower] GitHub Advisory: query failed for ${ghEcosystem}:`, err);
    return [];
  }
}
