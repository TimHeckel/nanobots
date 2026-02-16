import { BrowserManager } from "agent-browser/dist/browser.js";
import type { EnhancedSnapshot } from "agent-browser/dist/snapshot.js";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:6100";

/**
 * Launch a browser with standard config for e2e tests.
 * Uses kernel.sh when AGENT_BROWSER_PROVIDER=kernel is set (CI).
 * Uses local chromium otherwise (dev).
 */
export async function createBrowser(): Promise<BrowserManager> {
  const browser = new BrowserManager();
  const headless = !process.env.HEADED;
  const provider = process.env.AGENT_BROWSER_PROVIDER;

  await browser.launch({
    browser: "chromium",
    headless,
    ...(provider ? { provider } : {}),
  } as any);

  browser.startConsoleTracking();
  browser.startErrorTracking();
  return browser;
}

/**
 * Navigate to a path (relative to BASE_URL), wait for network idle.
 */
export async function navigate(browser: BrowserManager, path: string) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  await browser.getPage().goto(url, { waitUntil: "networkidle" });
}

/**
 * Assert no real console errors occurred.
 * Filters out known noise from React, Next.js, hydration, etc.
 */
export function assertNoErrors(browser: BrowserManager) {
  const errors = browser.getPageErrors();
  const noise = [
    "React DevTools",
    "Suspense",
    "startTransition",
    "hydrating",
    "hydration",
    "third-party cookie",
    "Download the React DevTools",
    "ResizeObserver loop",
    "Warning:",
  ];
  const real = errors.filter((e) => {
    const msg = e.message ?? String(e);
    return !noise.some((p) => msg.toLowerCase().includes(p.toLowerCase()));
  });
  if (real.length > 0) {
    throw new Error(`Console errors:\n${real.map((e) => e.message).join("\n")}`);
  }
}

/**
 * Poll until a condition is met on the snapshot, with configurable timeout.
 */
export async function waitForSnapshot(
  browser: BrowserManager,
  condition: (snap: EnhancedSnapshot) => boolean,
  { timeoutMs = 30000, pollMs = 500, description = "condition" } = {},
): Promise<EnhancedSnapshot> {
  const polls = Math.ceil(timeoutMs / pollMs);
  for (let i = 0; i < polls; i++) {
    const snap = await browser.getSnapshot();
    if (condition(snap)) return snap;
    await browser.getPage().waitForTimeout(pollMs);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

/**
 * Get the base URL used for navigation.
 */
export function getBaseUrl(): string {
  return BASE_URL;
}
