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

describe("Control Room — Chat Thread Continuity", () => {
  let browser: BrowserManager;
  let failThreadReload = false;

  beforeEach(async () => {
    browser = await createBrowser();
    failThreadReload = false;
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
    await browser
      .getPage()
      .route("**/api/compliance/sprinto/export", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            surface: "operator-control-room-sprinto",
            syncStatus: "succeeded",
            sessionId: "sess-thread-continuity",
            pushedEntities: 4,
            pushResponse: { accepted: true },
            closeResponse: { mode: "apply" },
          }),
        });
      });

    await browser
      .getPage()
      .route(`**/api/conversations/${conversationId}/messages`, async (route) => {
        if (failThreadReload) {
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              surface: "operator-control-room",
              conversationId,
              error: "Conversation thread unavailable",
            }),
          });
          return;
        }

        await route.fallback();
      });

    await browser.getPage().goto(`${getBaseUrl()}/chat/${conversationId}`, {
      waitUntil: "domcontentloaded",
    });

    await waitForSnapshot(
      browser,
      (snap) =>
        /sess-thread-continuity/i.test(snap.tree) &&
        /Missing evidence: incident response walkthrough recording\./i.test(
          snap.tree,
        ),
      { description: "deep route initial thread state" },
    );
  }

  it("round-trips a successful turn back through the route-backed thread payload after reload", async () => {
    const conversationId = "conv-thread-continuity-success";
    await loadConversationRoute(conversationId);
    assertNoErrors(browser);

    await sendChatMessage(browser, "What should I do next for CC8.1?");

    await waitForSnapshot(
      browser,
      (snap) =>
        /Route-backed next action: capture the release approval screenshot and resync Sprinto\./i.test(
          snap.tree,
        ),
      { description: "successful assistant response before thread reload" },
    );

    const reloadResponsePromise = browser
      .getPage()
      .waitForResponse((response) =>
        response
          .url()
          .includes(`/api/conversations/${conversationId}/messages`),
      );

    await browser
      .getPage()
      .getByRole("button", { name: /Reload thread/i })
      .click();

    const reloadResponse = await reloadResponsePromise;
    expect(reloadResponse.status()).toBe(200);

    await browser
      .getPage()
      .waitForFunction(() => {
        const panel = document.querySelector(
          '[data-testid="conversation-thread-panel"]',
        );

        return (
          panel?.textContent?.includes("What should I do next for CC8.1?") &&
          panel?.textContent?.includes(
            "Route-backed next action: capture the release approval screenshot and resync Sprinto.",
          )
        );
      });

    const threadPanelText = await browser
      .getPage()
      .getByTestId("conversation-thread-panel")
      .textContent();

    expect(threadPanelText).toContain("Conversation Thread");
    expect(threadPanelText).toContain(
      "Missing evidence: incident response walkthrough recording.",
    );
    expect(threadPanelText).toContain("What should I do next for CC8.1?");
    expect(threadPanelText).toContain(
      "Route-backed next action: capture the release approval screenshot and resync Sprinto.",
    );
  });

  it("shows an auditable failure state when the messages route fails during thread reload", async () => {
    const conversationId = "conv-thread-continuity-failure";
    await loadConversationRoute(conversationId);
    assertNoErrors(browser);

    await sendChatMessage(browser, "What should I do next for CC8.1?");

    await waitForSnapshot(
      browser,
      (snap) =>
        /Route-backed next action: capture the release approval screenshot and resync Sprinto\./i.test(
          snap.tree,
        ),
      { description: "successful assistant response before thread failure" },
    );

    failThreadReload = true;

    const reloadResponsePromise = browser
      .getPage()
      .waitForResponse((response) =>
        response
          .url()
          .includes(`/api/conversations/${conversationId}/messages`),
      );

    await browser
      .getPage()
      .getByRole("button", { name: /Reload thread/i })
      .click();

    const reloadResponse = await reloadResponsePromise;
    expect(reloadResponse.status()).toBe(503);

    await waitForSnapshot(
      browser,
      (snap) => /Conversation thread unavailable/i.test(snap.tree),
      { description: "thread reload failure state" },
    );

    const threadPanelText = await browser
      .getPage()
      .getByTestId("conversation-thread-panel")
      .textContent();

    expect(threadPanelText).toContain("Conversation Thread");
    expect(threadPanelText).toContain("Conversation thread unavailable");
  });
});
