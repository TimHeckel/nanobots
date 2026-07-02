import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BrowserManager } from "agent-browser/dist/browser.js";
import { createBrowser, navigate } from "./helpers";

describe("Control Room — Conversational Gap Resolution", () => {
  let browser: BrowserManager;

  beforeAll(async () => {
    browser = await createBrowser();
    await navigate(browser, "/chat");
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("shows conversation-driven gap resolution and next-action state", async () => {
    const snap = await browser.getSnapshot();

    expect(snap.tree).toMatch(/Resolve Evidence Gap/i);
    expect(snap.tree).toMatch(/Missing Evidence/i);
    expect(snap.tree).toMatch(/Next Recommended Action/i);
  });
});
