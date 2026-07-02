import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BrowserManager } from "agent-browser/dist/browser.js";

import {
  assertNoErrors,
  createBrowser,
  generateTestJwt,
  getBaseUrl,
  injectSessionCookie,
  sendChatMessage,
  waitForSnapshot,
} from "./helpers";

describe("Control Room — Sprinto Export Visibility", () => {
  let browser: BrowserManager;

  beforeEach(async () => {
    browser = await createBrowser();
    const token = await generateTestJwt({
      userId: "e2e-user",
      orgId: "e2e-org",
      role: "owner",
    });
    await injectSessionCookie(browser, token);
  });

  afterEach(async () => {
    await browser?.close();
  });

  it("shows the truthful local export empty state before any evidence source is connected", async () => {
    const page = browser.getPage();
    await page.goto(`${getBaseUrl()}/`, { waitUntil: "domcontentloaded" });

    const emptyStateSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Awaiting evidence sources/i.test(snap.tree) &&
        /No local export run/i.test(snap.tree) &&
        /Connect a source first/i.test(snap.tree),
      {
        description: "local export empty state",
      },
    );

    expect(emptyStateSnap.tree).toMatch(/Sprinto Export Status/i);
    expect(emptyStateSnap.tree).toMatch(/Awaiting evidence sources/i);
    expect(emptyStateSnap.tree).toMatch(/No local export run/i);
    expect(emptyStateSnap.tree).toMatch(/Connect a source first/i);
    assertNoErrors(browser);
  });

  it("moves export readiness into action-required after connecting a GitHub source", async () => {
    const page = browser.getPage();
    await page.goto(`${getBaseUrl()}/chat`, { waitUntil: "domcontentloaded" });

    await sendChatMessage(browser, "connect github acme/api");

    const actionRequiredSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Action required/i.test(snap.tree) &&
        /Local state not exportable yet/i.test(snap.tree) &&
        /Resolve gaps before export/i.test(snap.tree),
      {
        description: "local export action-required state",
      },
    );

    expect(actionRequiredSnap.tree).toMatch(/Connected GitHub evidence source acme\/api\./i);
    expect(actionRequiredSnap.tree).toMatch(/Action required/i);
    expect(actionRequiredSnap.tree).toMatch(/Local state not exportable yet/i);
    expect(actionRequiredSnap.tree).toMatch(/Resolve gaps before export/i);
    assertNoErrors(browser);
  });
});
