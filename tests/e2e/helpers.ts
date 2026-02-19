import { BrowserManager } from "agent-browser/dist/browser.js";
import type { EnhancedSnapshot } from "agent-browser/dist/snapshot.js";
import { SignJWT } from "jose";
import { neon } from "@neondatabase/serverless";

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

/**
 * Generate a JWT for authenticated e2e tests (same signing as the app).
 */
export async function generateTestJwt(payload: {
  userId: string;
  orgId: string;
  role: string;
}): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET required for chat e2e tests");
  const key = new TextEncoder().encode(secret);
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
}

/**
 * Inject the nb-session cookie into the browser context so /chat is accessible.
 */
export async function injectSessionCookie(
  browser: BrowserManager,
  token: string,
) {
  const baseUrl = getBaseUrl();
  const domain = new URL(baseUrl).hostname;
  const page = browser.getPage();
  await page.context().addCookies([
    {
      name: "nb-session",
      value: token,
      domain,
      path: "/",
      httpOnly: true,
      secure: baseUrl.startsWith("https"),
    },
  ]);
}

/**
 * Fetch a real user+org from the database for authenticated e2e tests.
 */
export async function getTestUserFromDb(): Promise<{
  userId: string;
  orgId: string;
}> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required for chat e2e tests");
  const sql = neon(dbUrl);
  const rows = await sql`
    SELECT u.id AS user_id, m.org_id
    FROM users u
    JOIN org_members m ON m.user_id = u.id
    LIMIT 1
  `;
  if (!rows.length) throw new Error("No user with org membership found in DB");
  return { userId: rows[0].user_id, orgId: rows[0].org_id };
}

/**
 * Type a message in the chat textarea and send it via Enter.
 * Waits for the textarea to be enabled (not loading) before typing.
 */
export async function sendChatMessage(browser: BrowserManager, text: string) {
  const page = browser.getPage();
  const textarea = page.getByPlaceholder("Ask nanobots anything...");
  await textarea.waitFor({ state: "visible", timeout: 30000 });
  // Wait until textarea is enabled (chat not loading)
  await page.waitForFunction(
    () => {
      const el = document.querySelector(
        'textarea[placeholder="Ask nanobots anything..."]',
      ) as HTMLTextAreaElement | null;
      return el && !el.disabled;
    },
    { timeout: 60000 },
  );
  await textarea.fill(text);
  await textarea.press("Enter");
}
