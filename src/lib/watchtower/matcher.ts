import { Advisory, DependencyIndex, ThreatMatch } from "./types";

/**
 * Basic semver check: returns true if the dependency version falls within
 * the advisory's affected version range.
 *
 * Supports simple patterns like ">= 1.0.0, < 2.0.0" and "< 3.1.0".
 * For v1 this is intentionally simple -- a full semver library is future work.
 */
function isVersionAffected(depVersion: string, rangeStr: string): boolean {
  // Parse the version into numeric parts for comparison
  const parseVersion = (v: string): number[] =>
    v.replace(/^v/, "").split(".").map((p) => parseInt(p, 10) || 0);

  const depParts = parseVersion(depVersion);

  // Compare two version arrays: returns -1, 0, or 1
  const compare = (a: number[], b: number[]): number => {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const av = a[i] ?? 0;
      const bv = b[i] ?? 0;
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return 0;
  };

  // Split range by comma for compound ranges like ">= 1.0, < 2.0"
  const conditions = rangeStr.split(",").map((s) => s.trim());

  for (const cond of conditions) {
    const match = cond.match(/^([><=!]+)\s*(.+)$/);
    if (!match) continue;

    const [, op, ver] = match;
    const targetParts = parseVersion(ver);
    const cmp = compare(depParts, targetParts);

    switch (op) {
      case ">=": if (cmp < 0) return false; break;
      case ">":  if (cmp <= 0) return false; break;
      case "<=": if (cmp > 0) return false; break;
      case "<":  if (cmp >= 0) return false; break;
      case "=":
      case "==": if (cmp !== 0) return false; break;
      case "!=": if (cmp === 0) return false; break;
    }
  }

  return true;
}

export function matchAdvisories(
  index: DependencyIndex,
  advisories: Advisory[]
): ThreatMatch[] {
  const matches: ThreatMatch[] = [];
  const seen = new Set<string>();

  for (const advisory of advisories) {
    for (const dep of index.dependencies) {
      // Match by package name (case-insensitive)
      if (dep.name.toLowerCase() !== advisory.affectedPackage.toLowerCase()) {
        continue;
      }

      // Deduplicate by advisory ID + dependency name
      const key = `${advisory.id}:${dep.name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // If there's a version range, check if this version is affected
      if (advisory.affectedVersionRange) {
        if (!isVersionAffected(dep.version, advisory.affectedVersionRange)) {
          continue;
        }
      }

      matches.push({
        advisory,
        dependency: dep,
        isReachable: true, // v1: assume all matches are reachable
      });
    }
  }

  return matches;
}
