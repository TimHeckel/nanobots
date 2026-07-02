import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BrowserManager } from "agent-browser/dist/browser.js";
import { createBrowser, navigate } from "./helpers";

describe("Control Room — Evidence Source Connection", () => {
  let browser: BrowserManager;

  beforeAll(async () => {
    browser = await createBrowser();
    await navigate(browser, "/chat");
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("shows connected-source workflows for GitHub and non-GitHub evidence", async () => {
    const snap = await browser.getSnapshot();

    expect(snap.tree).toMatch(/Connect GitHub/i);
    expect(snap.tree).toMatch(/Connect Screenshot Capture/i);
    expect(snap.tree).toMatch(/Connected Evidence Sources/i);
  });
});
