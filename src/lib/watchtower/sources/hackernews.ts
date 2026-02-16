import { Advisory } from "../types";

interface HNHit {
  objectID: string;
  title: string;
  url: string;
  created_at_i: number;
  story_url?: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchHN(query: string): Promise<HNHit[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=5`;
  const response = await fetch(url);

  if (!response.ok) {
    console.log(`[watchtower] HackerNews: search failed (${response.status})`);
    return [];
  }

  const data = await response.json();
  return data.hits ?? [];
}

function isRecent(hit: HNHit): boolean {
  const hitTime = hit.created_at_i * 1000;
  return Date.now() - hitTime < SEVEN_DAYS_MS;
}

function hitToAdvisory(hit: HNHit, packageName: string): Advisory {
  return {
    id: `hn-${hit.objectID}`,
    source: "hackernews",
    title: hit.title,
    description: `Hacker News discussion potentially related to ${packageName} security`,
    severity: "unknown",
    affectedPackage: packageName,
    url: hit.url || hit.story_url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    publishedAt: new Date(hit.created_at_i * 1000),
  };
}

export async function searchHackerNews(packageNames: string[]): Promise<Advisory[]> {
  console.log(`[watchtower] HackerNews: searching for ${packageNames.length} packages`);

  const advisories: Advisory[] = [];
  const seenIds = new Set<string>();

  for (const name of packageNames) {
    // Search for package + vulnerability
    const vulnHits = await searchHN(`${name} vulnerability`);
    await delay(100);

    // Search for CVE + package name
    const cveHits = await searchHN(`CVE ${name}`);
    await delay(100);

    const allHits = [...vulnHits, ...cveHits];

    for (const hit of allHits) {
      if (!isRecent(hit)) continue;
      if (seenIds.has(hit.objectID)) continue;
      seenIds.add(hit.objectID);

      advisories.push(hitToAdvisory(hit, name));
    }
  }

  console.log(`[watchtower] HackerNews: found ${advisories.length} recent discussions`);
  return advisories;
}
