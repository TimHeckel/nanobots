import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BrowserManager } from "agent-browser/dist/browser.js";
import {
  assertNoErrors,
  createBrowser,
  generateTestJwt,
  getBaseUrl,
  injectSessionCookie,
  waitForSnapshot,
} from "./helpers";

describe("Control Room — Deep Chat Route Entry", () => {
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

  it("stays on the shared control-room shell and renders the deterministic thread payload", async () => {
    await browser.getPage().route("**/api/compliance/sprinto/export", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          surface: "operator-control-room-sprinto",
          syncStatus: "succeeded",
          sessionId: "sess-chat-conversation",
          pushedEntities: 4,
          pushResponse: { accepted: true },
          closeResponse: { mode: "apply" },
        }),
      });
    });
    await browser.getPage().route("**/api/conversations/conv-control-gap/messages", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
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

    assertNoErrors(browser);
    const loadingSnap = await browser.getSnapshot();

    expect(loadingSnap.tree).toMatch(/Operator Control Room/i);
    expect(loadingSnap.tree).toMatch(/Evidence Sources/i);
    expect(loadingSnap.tree).toMatch(/Control Health/i);
    expect(loadingSnap.tree).toMatch(/Conversation Thread/i);
    expect(loadingSnap.tree).toMatch(/Loading thread from the operator message route/i);
    expect(loadingSnap.tree).toMatch(/Syncing Sprinto/i);

    const resolvedSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /sess-chat-conversation/i.test(snap.tree) &&
        /Missing evidence: incident response walkthrough recording\./i.test(
          snap.tree,
        ),
      { description: "deep chat route shell and thread resolution" },
    );

    expect(resolvedSnap.tree).toMatch(/Sprinto Export Status/i);
    expect(resolvedSnap.tree).toMatch(/sess-chat-conversation/i);
    expect(resolvedSnap.tree).toMatch(/Conversation Thread/i);
    expect(resolvedSnap.tree).toMatch(
      /Missing evidence: incident response walkthrough recording\./i,
    );
    expect(resolvedSnap.tree).not.toMatch(
      /Operator Control Room Conversation Detail/i,
    );
  });

  it("shows an auditable failure state when the message route fails", async () => {
    await browser.getPage().route("**/api/compliance/sprinto/export", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          surface: "operator-control-room-sprinto",
          syncStatus: "succeeded",
          sessionId: "sess-chat-conversation-failure",
          pushedEntities: 4,
          pushResponse: { accepted: true },
          closeResponse: { mode: "apply" },
        }),
      });
    });
    await browser.getPage().route("**/api/conversations/conv-control-gap/messages", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          surface: "operator-control-room",
          conversationId: "conv-control-gap",
          error: "Conversation thread unavailable",
        }),
      });
    });
    await browser.getPage().goto(`${getBaseUrl()}/chat/conv-control-gap`, {
      waitUntil: "domcontentloaded",
    });

    const failureSnap = await waitForSnapshot(
      browser,
      (snap) => /Conversation thread unavailable/i.test(snap.tree),
      { description: "deep chat route thread failure state" },
    );

    expect(failureSnap.tree).toMatch(/Operator Control Room/i);
    expect(failureSnap.tree).toMatch(/Conversation Thread/i);
    expect(failureSnap.tree).toMatch(/Conversation thread unavailable/i);
    expect(failureSnap.tree).toMatch(/sess-chat-conversation-failure/i);
  });
});
