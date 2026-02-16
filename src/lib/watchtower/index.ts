import { getInstallationOctokit, getFileContent, createFixPR } from "../github";
import { indexDependencies } from "./dependency-index";
import { matchAdvisories } from "./matcher";
import { queryOSV } from "./sources/osv";
import { queryGitHubAdvisories } from "./sources/github-advisory";
import { searchHackerNews } from "./sources/hackernews";
import { fetchCISAKEV } from "./sources/cisa-kev";
import { generateProposalForAdvisory, getAffectedBots } from "./proposal-generator";
import { getOrgByInstallationId } from "../db/queries/organizations";
import { logActivity } from "../db/queries/activity-log";
import { Advisory, ThreatMatch, WatchtowerResult } from "./types";

const ECOSYSTEM_FILE_MAP: Record<string, string> = {
  npm: "package.json",
  pypi: "requirements.txt",
  go: "go.mod",
  rubygems: "Gemfile.lock",
};

function buildIssueBody(match: ThreatMatch): string {
  const { advisory, dependency } = match;
  const lines = [
    `## Security Advisory: ${advisory.title}`,
    "",
    `**Package:** \`${dependency.name}@${dependency.version}\` (${dependency.ecosystem})`,
    `**Severity:** ${advisory.severity}`,
    `**Source:** ${advisory.source}`,
    advisory.cveId ? `**CVE:** ${advisory.cveId}` : null,
    advisory.affectedVersionRange ? `**Affected versions:** ${advisory.affectedVersionRange}` : null,
    advisory.fixedVersion ? `**Fix available:** upgrade to \`${advisory.fixedVersion}\`` : null,
    "",
    advisory.description,
    "",
    `**Reference:** ${advisory.url}`,
    "",
    "---",
    "*Detected by [nanobots.sh](https://nanobots.sh/chat) — Watchtower threat intelligence*",
  ];

  return lines.filter((l) => l !== null).join("\n");
}

function buildBumpPRBody(match: ThreatMatch): string {
  const { advisory, dependency } = match;
  return [
    `## Security: bump ${dependency.name} to ${advisory.fixedVersion}`,
    "",
    `Watchtower detected that \`${dependency.name}@${dependency.version}\` is affected by **${advisory.title}**.`,
    "",
    `- **Severity:** ${advisory.severity}`,
    advisory.cveId ? `- **CVE:** ${advisory.cveId}` : null,
    `- **Fix:** upgrade to \`${advisory.fixedVersion}\``,
    `- **Reference:** ${advisory.url}`,
    "",
    "---",
    "*Automated by [nanobots.sh](https://nanobots.sh) — Watchtower threat intelligence*",
  ].filter((l) => l !== null).join("\n");
}

function bumpVersionInPackageJson(content: string, pkgName: string, newVersion: string): string {
  const pkg = JSON.parse(content);

  if (pkg.dependencies?.[pkgName]) {
    pkg.dependencies[pkgName] = `^${newVersion}`;
  }
  if (pkg.devDependencies?.[pkgName]) {
    pkg.devDependencies[pkgName] = `^${newVersion}`;
  }

  return JSON.stringify(pkg, null, 2) + "\n";
}

function bumpVersionInRequirementsTxt(content: string, pkgName: string, newVersion: string): string {
  return content
    .split("\n")
    .map((line) => {
      const match = line.match(/^([a-zA-Z0-9._-]+)==(.+)$/);
      if (match && match[1] === pkgName) {
        return `${pkgName}==${newVersion}`;
      }
      return line;
    })
    .join("\n");
}

export async function runWatchtower(
  installationId: number,
  owner: string,
  repo: string
): Promise<WatchtowerResult> {
  console.log(`[watchtower] Starting scan: ${owner}/${repo}`);
  const startTime = Date.now();

  // 1. Get authenticated octokit
  const octokit = await getInstallationOctokit(installationId);

  // 2. Index dependencies
  const index = await indexDependencies(octokit, owner, repo);

  if (index.dependencies.length === 0) {
    console.log("[watchtower] No dependencies found, skipping");
    return {
      matches: [],
      advisoriesChecked: 0,
      dependenciesIndexed: 0,
      sources: [],
    };
  }

  // 3. Query all sources in parallel
  const ecosystems = [...new Set(index.dependencies.map((d) => d.ecosystem))];

  // OSV queries: one per dependency
  const osvPromises = index.dependencies.map((dep) =>
    queryOSV(dep.name, dep.version, dep.ecosystem).catch((err) => {
      console.error(`[watchtower] OSV query failed for ${dep.name}:`, err);
      return [] as Advisory[];
    })
  );

  // GitHub Advisory queries: one per ecosystem
  const ghPromises = ecosystems.map((eco) =>
    queryGitHubAdvisories(eco, octokit).catch((err) => {
      console.error(`[watchtower] GitHub Advisory query failed for ${eco}:`, err);
      return [] as Advisory[];
    })
  );

  // HackerNews: search top package names (limit to 10 to avoid rate limits)
  const topPackageNames = index.dependencies.slice(0, 10).map((d) => d.name);
  const hnPromise = searchHackerNews(topPackageNames).catch((err) => {
    console.error("[watchtower] HackerNews search failed:", err);
    return [] as Advisory[];
  });

  // CISA KEV
  const kevPromise = fetchCISAKEV().catch((err) => {
    console.error("[watchtower] CISA KEV fetch failed:", err);
    return [] as Advisory[];
  });

  const [osvResults, ghResults, hnResults, kevResults] = await Promise.all([
    Promise.all(osvPromises),
    Promise.all(ghPromises),
    hnPromise,
    kevPromise,
  ]);

  // 4. Combine all advisories
  const allAdvisories: Advisory[] = [
    ...osvResults.flat(),
    ...ghResults.flat(),
    ...hnResults,
    ...kevResults,
  ];

  const sources: string[] = [];
  if (osvResults.flat().length > 0) sources.push("osv");
  if (ghResults.flat().length > 0) sources.push("github");
  if (hnResults.length > 0) sources.push("hackernews");
  if (kevResults.length > 0) sources.push("cisa-kev");

  console.log(`[watchtower] Collected ${allAdvisories.length} advisories from ${sources.length} sources`);

  // 5. Run matcher
  const matches = matchAdvisories(index, allAdvisories);
  console.log(`[watchtower] Found ${matches.length} matches`);

  // 6. Create issues and PRs for matches
  for (const match of matches) {
    try {
      // Create an issue
      const { data: issue } = await octokit.issues.create({
        owner,
        repo,
        title: `[Watchtower] ${match.advisory.severity.toUpperCase()}: ${match.advisory.title} (${match.dependency.name})`,
        body: buildIssueBody(match),
        labels: ["security", "watchtower"],
      });
      console.log(`[watchtower] Created issue #${issue.number} for ${match.advisory.id}`);

      // 7. If a fixed version exists, create a version bump PR
      if (match.advisory.fixedVersion) {
        const manifestFile = ECOSYSTEM_FILE_MAP[match.dependency.ecosystem];
        if (manifestFile) {
          try {
            const { content: manifestContent } = await getFileContent(
              octokit,
              owner,
              repo,
              manifestFile
            );

            let updatedContent: string;
            if (match.dependency.ecosystem === "npm") {
              updatedContent = bumpVersionInPackageJson(
                manifestContent,
                match.dependency.name,
                match.advisory.fixedVersion
              );
            } else if (match.dependency.ecosystem === "pypi") {
              updatedContent = bumpVersionInRequirementsTxt(
                manifestContent,
                match.dependency.name,
                match.advisory.fixedVersion
              );
            } else {
              // go.mod and Gemfile.lock bumps are non-trivial, skip for v1
              continue;
            }

            const timestamp = Date.now().toString(36);
            const branchName = `watchtower/bump-${match.dependency.name}-${timestamp}`;

            const { prUrl } = await createFixPR(octokit, owner, repo, {
              branchName,
              title: `fix(security): bump ${match.dependency.name} to ${match.advisory.fixedVersion}`,
              body: buildBumpPRBody(match),
              files: [{ path: manifestFile, content: updatedContent }],
            });

            console.log(`[watchtower] Created fix PR: ${prUrl}`);
          } catch (err) {
            console.error(`[watchtower] Failed to create fix PR for ${match.dependency.name}:`, err);
          }
        }
      }
    } catch (err) {
      console.error(`[watchtower] Failed to create issue for ${match.advisory.id}:`, err);
    }
  }

  // 8. Generate prompt proposals for relevant advisories
  const org = await getOrgByInstallationId(installationId).catch(() => null);
  if (org) {
    for (const match of matches) {
      const affectedBots = getAffectedBots(match.advisory);
      if (affectedBots.length > 0) {
        generateProposalForAdvisory(org.id, match.advisory, affectedBots).catch((err) => {
          console.error(`[watchtower] Proposal generation failed for ${match.advisory.id}:`, err);
        });
      }
    }

    // Log activity
    if (matches.length > 0) {
      await logActivity(org.id, "threat_detected", `Watchtower found ${matches.length} threat(s) affecting your dependencies`, {
        matchCount: matches.length,
        sources,
      }).catch(() => {});
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[watchtower] Scan complete: ${owner}/${repo} in ${duration}ms, ${matches.length} threats found`);

  return {
    matches,
    advisoriesChecked: allAdvisories.length,
    dependenciesIndexed: index.dependencies.length,
    sources,
  };
}
