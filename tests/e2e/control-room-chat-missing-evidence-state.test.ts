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
  "Release verification still lacks a screenshot from the production change window.";
const ROUTE_BACKED_MISSING_EVIDENCE =
  "Release verification now needs the release approval screenshot attached to CC8.1 before Sprinto sync can close.";

describe("Control Room — Chat Missing Evidence State", () => {
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

  async function loadConversationRoute() {
    await browser
      .getPage()
      .route("**/api/compliance/sprinto/export", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            surface: "operator-control-room-sprinto",
            syncStatus: "succeeded",
            sessionId: "sess-chat-missing-evidence",
            pushedEntities: 4,
            pushResponse: { accepted: true },
            closeResponse: { mode: "apply" },
          }),
        });
      });

    await browser
      .getPage()
      .route("**/api/conversations/conv-control-gap/messages", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            surface: "operator-control-room",
            conversationId: "conv-control-gap",
            messages: [
              {
                id: "msg-gap-summary",
                role: "assistant",
                text: "Missing evidence: incident response walkthrough recording.",
              },
            ],
          }),
        });
      });

    await browser.getPage().goto(`${getBaseUrl()}/chat/conv-control-gap`, {
      waitUntil: "domcontentloaded",
    });

    await waitForSnapshot(
      browser,
      (snap) =>
        /Missing evidence: incident response walkthrough recording\./i.test(
          snap.tree,
        ) && new RegExp(INITIAL_MISSING_EVIDENCE, "i").test(snap.tree),
      { description: "conversation route initial missing evidence state" },
    );
  }

  it("updates the missing evidence panel after a successful live chat turn", async () => {
    await loadConversationRoute();
    assertNoErrors(browser);

    await sendChatMessage(browser, "What should I do next for CC8.1?");

    const successSnap = await waitForSnapshot(
      browser,
      (snap) =>
        new RegExp(ROUTE_BACKED_MISSING_EVIDENCE, "i").test(snap.tree) &&
        /Route-backed next action: capture the release approval screenshot and resync Sprinto\./i.test(
          snap.tree,
        ),
      { description: "route-backed missing evidence panel update" },
    );

    expect(successSnap.tree).toMatch(/Operator Control Room/i);
    expect(successSnap.tree).toMatch(/Missing Evidence/i);
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_MISSING_EVIDENCE, "i"),
    );
    expect(successSnap.tree).not.toMatch(
      new RegExp(INITIAL_MISSING_EVIDENCE, "i"),
    );
  });

  it("shows an auditable failure without mutating the missing evidence panel", async () => {
    await loadConversationRoute();
    assertNoErrors(browser);

    await sendChatMessage(browser, "force chat route failure");

    const failureSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Control-room response unavailable\. Retry the operator request\./i.test(
          snap.tree,
        ) && new RegExp(INITIAL_MISSING_EVIDENCE, "i").test(snap.tree),
      { description: "chat route failure with unchanged missing evidence state" },
    );

    expect(failureSnap.tree).toMatch(/Operator Control Room/i);
    expect(failureSnap.tree).toMatch(/Missing Evidence/i);
    expect(failureSnap.tree).toMatch(
      /Control-room response unavailable\. Retry the operator request\./i,
    );
    expect(failureSnap.tree).toMatch(new RegExp(INITIAL_MISSING_EVIDENCE, "i"));
    expect(failureSnap.tree).not.toMatch(
      new RegExp(ROUTE_BACKED_MISSING_EVIDENCE, "i"),
    );
  });
});
