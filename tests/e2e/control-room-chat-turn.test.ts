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

describe("Control Room — Live Chat Turn", () => {
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
            sessionId: "sess-chat-turn",
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
        ) && /sess-chat-turn/i.test(snap.tree),
      { description: "deep route initial shell state" },
    );
  }

  it("renders one operator turn and one live route-backed response inside the control-room shell", async () => {
    await loadConversationRoute();
    assertNoErrors(browser);

    const routeResponsePromise = browser
      .getPage()
      .waitForResponse(
        (response) =>
          response.url().includes("/api/chat") &&
          response.request().method() === "POST",
      );

    await sendChatMessage(browser, "What should I do next for CC8.1?");

    const routeResponse = await routeResponsePromise;
    expect(routeResponse.status()).toBe(200);

    const operatorSnap = await waitForSnapshot(
      browser,
      (snap) => /What should I do next for CC8\.1\?/i.test(snap.tree),
      { description: "operator message render" },
    );

    expect(operatorSnap.tree).toMatch(/Operator Control Room/i);
    expect(operatorSnap.tree).toMatch(/Conversation Thread/i);
    expect(operatorSnap.tree).toMatch(/What should I do next for CC8\.1\?/i);

    const successSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Route-backed next action: capture the release approval screenshot and resync Sprinto\./i.test(
          snap.tree,
        ),
      { description: "route-backed assistant turn render" },
    );

    expect(successSnap.tree).toMatch(/Operator Control Room/i);
    expect(successSnap.tree).toMatch(
      /Route-backed next action: capture the release approval screenshot and resync Sprinto\./i,
    );
    expect(successSnap.tree).toMatch(/sess-chat-turn/i);
  });

  it("shows an auditable failure state when the live chat route fails", async () => {
    await loadConversationRoute();
    assertNoErrors(browser);

    const routeResponsePromise = browser
      .getPage()
      .waitForResponse(
        (response) =>
          response.url().includes("/api/chat") &&
          response.request().method() === "POST",
      );

    await sendChatMessage(browser, "force chat route failure");

    const routeResponse = await routeResponsePromise;
    expect(routeResponse.status()).toBe(503);

    const failureSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Control-room response unavailable\. Retry the operator request\./i.test(
          snap.tree,
        ) &&
        /force chat route failure/i.test(snap.tree),
      { description: "auditable chat route failure state" },
    );

    expect(failureSnap.tree).toMatch(/Operator Control Room/i);
    expect(failureSnap.tree).toMatch(/Conversation Thread/i);
    expect(failureSnap.tree).toMatch(/force chat route failure/i);
    expect(failureSnap.tree).toMatch(
      /Control-room response unavailable\. Retry the operator request\./i,
    );
  });
});
