import { Octokit } from "@octokit/rest";
import { getFileContent } from "../github";
import { Dependency, DependencyIndex } from "./types";

function parsePackageJson(content: string): Dependency[] {
  try {
    const pkg = JSON.parse(content);
    const deps: Dependency[] = [];

    for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
      deps.push({
        name,
        version: String(version).replace(/^[\^~>=<]*/g, ""),
        ecosystem: "npm",
      });
    }

    for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
      deps.push({
        name,
        version: String(version).replace(/^[\^~>=<]*/g, ""),
        ecosystem: "npm",
      });
    }

    return deps;
  } catch {
    console.log("[watchtower] dependency-index: failed to parse package.json");
    return [];
  }
}

function parseRequirementsTxt(content: string): Dependency[] {
  const deps: Dependency[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;

    const match = trimmed.match(/^([a-zA-Z0-9._-]+)==(.+)$/);
    if (match) {
      deps.push({ name: match[1], version: match[2], ecosystem: "pypi" });
    }
  }

  return deps;
}

function parseGoMod(content: string): Dependency[] {
  const deps: Dependency[] = [];
  const lines = content.split("\n");
  let inRequire = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "require (") {
      inRequire = true;
      continue;
    }

    if (trimmed === ")") {
      inRequire = false;
      continue;
    }

    // Single-line require
    const singleMatch = trimmed.match(/^require\s+(\S+)\s+(\S+)/);
    if (singleMatch) {
      deps.push({ name: singleMatch[1], version: singleMatch[2], ecosystem: "go" });
      continue;
    }

    // Inside require block
    if (inRequire) {
      const blockMatch = trimmed.match(/^(\S+)\s+(\S+)/);
      if (blockMatch && !blockMatch[1].startsWith("//")) {
        deps.push({ name: blockMatch[1], version: blockMatch[2], ecosystem: "go" });
      }
    }
  }

  return deps;
}

function parseGemfileLock(content: string): Dependency[] {
  const deps: Dependency[] = [];
  const lines = content.split("\n");
  let inSpecs = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "specs:") {
      inSpecs = true;
      continue;
    }

    // End of specs section when we hit a non-indented line
    if (inSpecs && line.length > 0 && !line.startsWith(" ")) {
      inSpecs = false;
      continue;
    }

    if (inSpecs) {
      // Gem entries are indented with 4 or 6 spaces: "    gem-name (1.2.3)"
      const match = trimmed.match(/^([a-zA-Z0-9._-]+)\s+\(([^)]+)\)$/);
      if (match) {
        deps.push({ name: match[1], version: match[2], ecosystem: "rubygems" });
      }
    }
  }

  return deps;
}

async function tryFetchFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  try {
    const { content } = await getFileContent(octokit, owner, repo, path);
    return content;
  } catch {
    return null;
  }
}

export async function indexDependencies(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<DependencyIndex> {
  console.log(`[watchtower] dependency-index: indexing ${owner}/${repo}`);

  const dependencies: Dependency[] = [];

  // Fetch all manifest files in parallel
  const [packageJson, requirementsTxt, goMod, gemfileLock] = await Promise.all([
    tryFetchFile(octokit, owner, repo, "package.json"),
    tryFetchFile(octokit, owner, repo, "requirements.txt"),
    tryFetchFile(octokit, owner, repo, "go.mod"),
    tryFetchFile(octokit, owner, repo, "Gemfile.lock"),
  ]);

  if (packageJson) {
    const deps = parsePackageJson(packageJson);
    console.log(`[watchtower] dependency-index: found ${deps.length} npm dependencies`);
    dependencies.push(...deps);
  }

  if (requirementsTxt) {
    const deps = parseRequirementsTxt(requirementsTxt);
    console.log(`[watchtower] dependency-index: found ${deps.length} pypi dependencies`);
    dependencies.push(...deps);
  }

  if (goMod) {
    const deps = parseGoMod(goMod);
    console.log(`[watchtower] dependency-index: found ${deps.length} go dependencies`);
    dependencies.push(...deps);
  }

  if (gemfileLock) {
    const deps = parseGemfileLock(gemfileLock);
    console.log(`[watchtower] dependency-index: found ${deps.length} rubygems dependencies`);
    dependencies.push(...deps);
  }

  console.log(`[watchtower] dependency-index: total ${dependencies.length} dependencies`);

  return {
    dependencies,
    repoOwner: owner,
    repoName: repo,
    indexedAt: new Date(),
  };
}
