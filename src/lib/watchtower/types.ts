export interface Dependency {
  name: string;
  version: string;
  ecosystem: "npm" | "pypi" | "go" | "rubygems";
}

export interface DependencyIndex {
  dependencies: Dependency[];
  repoOwner: string;
  repoName: string;
  indexedAt: Date;
}

export interface Advisory {
  id: string;
  source: "osv" | "github" | "cisa-kev" | "hackernews";
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "unknown";
  cveId?: string;
  affectedPackage: string;
  affectedVersionRange?: string;
  fixedVersion?: string;
  url: string;
  publishedAt: Date;
}

export interface ThreatMatch {
  advisory: Advisory;
  dependency: Dependency;
  isReachable: boolean;
}

export interface WatchtowerResult {
  matches: ThreatMatch[];
  advisoriesChecked: number;
  dependenciesIndexed: number;
  sources: string[];
}
