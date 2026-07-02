import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BrowserManager } from "agent-browser/dist/browser.js";
import { createBrowser, navigate } from "./helpers";

describe("Control Room — Control Mapping", () => {
  let browser: BrowserManager;

  beforeAll(async () => {
    browser = await createBrowser();
    await navigate(browser, "/chat");
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("shows Sprinto-oriented control mapping state", async () => {
    const snap = await browser.getSnapshot();

    expect(snap.tree).toMatch(/Mapped Controls/i);
    expect(snap.tree).toMatch(/Sprinto Control Mapping/i);
    expect(snap.tree).toMatch(/Provable Middle/i);
  });
});
