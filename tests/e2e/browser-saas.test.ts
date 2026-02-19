/**
 * Browser E2E Tests for nanobots.sh SaaS App
 *
 * Uses agent-browser with kernel.sh as the browser provider in CI.
 *
 * Prerequisites:
 *   - App deployed at E2E_BASE_URL (default: http://localhost:6100)
 *   - For CI: AGENT_BROWSER_PROVIDER=kernel and KERNEL_API_KEY set
 *   - For local: npm run dev + HEADED=1 for visible browser
 *
 * Run locally:
 *   E2E_BASE_URL=http://localhost:6100 npx vitest run --config vitest.config.e2e.ts
 *
 * Run in CI:
 *   AGENT_BROWSER_PROVIDER=kernel KERNEL_API_KEY=xxx E2E_BASE_URL=https://nanobots.sh npx vitest run --config vitest.config.e2e.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createBrowser, navigate, assertNoErrors, waitForSnapshot } from "./helpers";
import type { BrowserManager } from "agent-browser/dist/browser.js";

describe("Landing Page", () => {
  let browser: BrowserManager;

  beforeAll(async () => {
    browser = await createBrowser();
    await navigate(browser, "/");
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("loads without console errors", () => {
    assertNoErrors(browser);
  });

  it("shows hero heading with nanobots branding", async () => {
    const snap = await browser.getSnapshot();
    expect(snap.tree).toMatch(/nanobots/i);
  });

  it("has Get Started CTA", async () => {
    const page = browser.getPage();
    const btn = page.getByRole("link", { name: "Get Started", exact: true });
    expect(await btn.isVisible()).toBe(true);
  });

  it("shows feature sections", async () => {
    const snap = await browser.getSnapshot();
    // The landing page should mention key features
    const tree = snap.tree.toLowerCase();
    expect(
      tree.includes("scanner") || tree.includes("security") || tree.includes("bot"),
    ).toBe(true);
  });

  it("shows pricing section", async () => {
    const snap = await browser.getSnapshot();
    const tree = snap.tree.toLowerCase();
    expect(tree.includes("free") || tree.includes("pricing") || tree.includes("$")).toBe(true);
  });
});

describe("Auth Flow", () => {
  let browser: BrowserManager;

  beforeAll(async () => {
    browser = await createBrowser();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("Get Started redirects to GitHub OAuth", async () => {
    await navigate(browser, "/");
    const page = browser.getPage();

    // Click the Get Started link
    const btn = page.getByRole("link", { name: "Get Started", exact: true });
    await btn.click();
    await page.waitForTimeout(2000);

    // Should redirect to GitHub OAuth
    const url = page.url();
    expect(url).toMatch(/github\.com\/login/);
  });

  it("unauthenticated /chat redirects to landing", async () => {
    await navigate(browser, "/chat");
    const page = browser.getPage();
    await page.waitForTimeout(1000);

    // Middleware should redirect unauthenticated users to /
    const url = page.url();
    expect(url).not.toMatch(/\/chat/);
  });
});

describe("Responsive Layout", () => {
  let browser: BrowserManager;

  beforeAll(async () => {
    browser = await createBrowser();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("renders on mobile viewport (375x812)", async () => {
    await browser.setViewport(375, 812);
    await navigate(browser, "/");

    const snap = await browser.getSnapshot();
    expect(snap.tree).toMatch(/nanobots/i);

    // On mobile the nav CTA may be collapsed; verify the page content loads
    const tree = snap.tree.toLowerCase();
    expect(tree.includes("bot") || tree.includes("scanner") || tree.includes("security")).toBe(true);
  });

  it("renders on desktop viewport (1440x900)", async () => {
    await browser.setViewport(1440, 900);
    await navigate(browser, "/");

    const snap = await browser.getSnapshot();
    expect(snap.tree).toMatch(/nanobots/i);

    const page = browser.getPage();
    const getStarted = page.getByRole("link", { name: "Get Started", exact: true });
    expect(await getStarted.isVisible()).toBe(true);
  });
});
