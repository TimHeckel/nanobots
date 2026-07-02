import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BrowserManager } from "agent-browser/dist/browser.js";
import {
  assertNoErrors,
  createBrowser,
  getBaseUrl,
  waitForSnapshot,
} from "./helpers";

describe("Control Room — Authenticated Entry", () => {
  let browser: BrowserManager;

  beforeAll(async () => {
    browser = await createBrowser();
    await browser
      .getPage()
      .goto(`${getBaseUrl()}/chat`, { waitUntil: "domcontentloaded" });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("shows the operator control room shell instead of the chat stub", async () => {
    assertNoErrors(browser);
    const loadingSnap = await browser.getSnapshot();

    expect(loadingSnap.tree).toMatch(/Operator Control Room/i);
    expect(loadingSnap.tree).toMatch(/Evidence Sources/i);
    expect(loadingSnap.tree).toMatch(/Control Health/i);
    expect(loadingSnap.tree).toMatch(/Awaiting evidence sources/i);
    expect(loadingSnap.tree).toMatch(/No evidence sources connected/i);

    const resolvedSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Conversation Panel/i.test(snap.tree) &&
        /Awaiting evidence sources/i.test(snap.tree),
      { description: "chat entry control-room local readiness state" },
    );

    expect(resolvedSnap.tree).toMatch(/Sprinto Export Status/i);
    expect(resolvedSnap.tree).toMatch(/No local export run/i);
    expect(resolvedSnap.tree).toMatch(/Connect a source first/i);
    expect(resolvedSnap.tree).not.toMatch(/Operator Control Room Conversation/i);
  });
});
