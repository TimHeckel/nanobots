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

const INITIAL_MISSING_EVIDENCE =
  "GitHub PR approval evidence, Release approval screenshot still missing for CC8.1.";
const INITIAL_NEXT_ACTION =
  "Sync GitHub PR review evidence, then attach the release approval screenshot to CC8.1.";
const ROUTE_BACKED_MISSING_EVIDENCE =
  "Release verification now needs the release approval screenshot attached to CC8.1 before Sprinto sync can close.";
const ROUTE_BACKED_NEXT_ACTION =
  "Attach the release approval screenshot to CC8.1 and rerun the Sprinto sync check.";

describe("Control Room — Chat Gap State", () => {
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

  async function loadConversationRoute(conversationId: string) {
    await browser.getPage().goto(`${getBaseUrl()}/chat/${conversationId}`, {
      waitUntil: "domcontentloaded",
    });

    await waitForSnapshot(
      browser,
      (snap) =>
        /Conversation Panel/i.test(snap.tree) &&
        new RegExp(INITIAL_MISSING_EVIDENCE, "i").test(snap.tree) &&
        new RegExp(INITIAL_NEXT_ACTION, "i").test(snap.tree),
      { description: "conversation route initial live gap-state panels" },
    );
  }

  it("updates missing evidence alongside next action after a successful live chat turn", async () => {
    await loadConversationRoute("conv-control-gap-success");
    assertNoErrors(browser);

    await sendChatMessage(browser, "What should I do next for CC8.1?");

    const successSnap = await waitForSnapshot(
      browser,
      (snap) =>
        new RegExp(ROUTE_BACKED_MISSING_EVIDENCE, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_NEXT_ACTION, "i").test(snap.tree),
      { description: "route-backed missing-evidence and next-action updates" },
    );

    expect(successSnap.tree).toMatch(/Conversation Thread/i);
    expect(successSnap.tree).toMatch(/Conversation Panel/i);
    expect(successSnap.tree).toMatch(/Missing Evidence/i);
    expect(successSnap.tree).toMatch(/Next Recommended Action/i);
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_MISSING_EVIDENCE, "i"),
    );
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_NEXT_ACTION, "i"),
    );
    expect(successSnap.tree).not.toMatch(
      new RegExp(INITIAL_MISSING_EVIDENCE, "i"),
    );
    expect(successSnap.tree).not.toMatch(new RegExp(INITIAL_NEXT_ACTION, "i"));
  });

  it("shows an auditable failure without mutating either route-backed gap panel", async () => {
    await loadConversationRoute("conv-control-gap-failure");
    assertNoErrors(browser);

    await sendChatMessage(browser, "force chat route failure");

    const failureSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Control-room response unavailable\. Retry the operator request\./i.test(
          snap.tree,
        ),
      { description: "chat route failure without gap-panel mutation" },
    );

    expect(failureSnap.tree).toMatch(/Conversation Thread/i);
    expect(failureSnap.tree).toMatch(/Conversation Panel/i);
    expect(failureSnap.tree).toMatch(/Chat route failure/i);
    expect(failureSnap.tree).toMatch(
      /Control-room response unavailable\. Retry the operator request\./i,
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_MISSING_EVIDENCE, "i"),
    );
    expect(failureSnap.tree).toMatch(new RegExp(ROUTE_BACKED_NEXT_ACTION, "i"));
  });
});
