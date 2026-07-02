import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BrowserManager } from "agent-browser/dist/browser.js";
import { createBrowser, navigate } from "./helpers";

describe("Control Room — Monitoring And Exceptions", () => {
  let browser: BrowserManager;

  beforeAll(async () => {
    browser = await createBrowser();
    await navigate(browser, "/chat");
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("shows continuous monitoring state and visible exceptions", async () => {
    const snap = await browser.getSnapshot();

    expect(snap.tree).toMatch(/Monitoring Status/i);
    expect(snap.tree).toMatch(/Exceptions/i);
    expect(snap.tree).toMatch(/Control Freshness/i);
  });
});
