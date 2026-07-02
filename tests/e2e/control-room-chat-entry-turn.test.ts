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

describe("Control Room — Chat Entry Turn", () => {
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

  async function loadChatEntryRoute() {
    await browser.getPage().goto(`${getBaseUrl()}/chat`, {
      waitUntil: "domcontentloaded",
    });

    await waitForSnapshot(
      browser,
      (snap) =>
        /Awaiting evidence sources/i.test(snap.tree) &&
        /Conversation Panel/i.test(snap.tree),
      { description: "chat entry route live control-room surface" },
    );
  }

  it("mounts the live chat surface on /chat and renders one deterministic route-backed turn", async () => {
    await loadChatEntryRoute();
    assertNoErrors(browser);

    const readySnap = await browser.getSnapshot();

    expect(readySnap.tree).toMatch(/Operator Control Room/i);
    expect(readySnap.tree).toMatch(/Conversation Panel/i);
    expect(readySnap.tree).toMatch(/No operator updates submitted yet\./i);
    expect(readySnap.tree).toMatch(/Awaiting evidence sources/i);

    await sendChatMessage(browser, "What evidence should I collect first?");

    const operatorSnap = await waitForSnapshot(
      browser,
      (snap) => /What evidence should I collect first\?/i.test(snap.tree),
      { description: "operator turn on chat entry route" },
    );

    expect(operatorSnap.tree).toMatch(/Operator Control Room/i);
    expect(operatorSnap.tree).toMatch(/Conversation Panel/i);
    expect(operatorSnap.tree).toMatch(/What evidence should I collect first\?/i);

    const successSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Route-backed next action: capture the release approval screenshot and resync Sprinto\./i.test(
          snap.tree,
        ),
      { description: "assistant turn on chat entry route" },
    );

    expect(successSnap.tree).toMatch(/Operator Control Room/i);
    expect(successSnap.tree).toMatch(/Conversation Panel/i);
    expect(successSnap.tree).toMatch(/Conversation ID: new/i);
    expect(successSnap.tree).toMatch(
      /Route-backed next action: capture the release approval screenshot and resync Sprinto\./i,
    );
  });

  it("shows an auditable failure state on /chat when the chat route fails", async () => {
    await loadChatEntryRoute();
    assertNoErrors(browser);

    await sendChatMessage(browser, "force chat route failure");

    const failureSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /force chat route failure/i.test(snap.tree) &&
        /Control-room response unavailable\. Retry the operator request\./i.test(
          snap.tree,
        ),
      { description: "chat entry route failure state" },
    );

    expect(failureSnap.tree).toMatch(/Operator Control Room/i);
    expect(failureSnap.tree).toMatch(/Conversation Panel/i);
    expect(failureSnap.tree).toMatch(/force chat route failure/i);
    expect(failureSnap.tree).toMatch(/Chat route failure/i);
    expect(failureSnap.tree).toMatch(
      /Control-room response unavailable\. Retry the operator request\./i,
    );
  });
});
