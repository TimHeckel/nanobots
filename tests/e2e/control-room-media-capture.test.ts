import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BrowserManager } from "agent-browser/dist/browser.js";
import { createBrowser, navigate } from "./helpers";

describe("Control Room — Non-GitHub Media Capture", () => {
  let browser: BrowserManager;

  beforeAll(async () => {
    browser = await createBrowser();
    await navigate(browser, "/chat");
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("shows screenshot and video evidence capture workflows", async () => {
    const snap = await browser.getSnapshot();

    expect(snap.tree).toMatch(/Capture Screenshot Evidence/i);
    expect(snap.tree).toMatch(/Capture Video Evidence/i);
    expect(snap.tree).toMatch(/Media Evidence/i);
  });
});
