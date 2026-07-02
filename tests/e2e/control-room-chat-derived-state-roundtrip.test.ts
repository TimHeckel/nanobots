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

const INITIAL_BROWSER_CAPTURE_STATUS = "Queued";
const INITIAL_BROWSER_CAPTURE_DETAIL =
  "Release approval screenshot capture is queued for CC8.1 evidence collection.";
const INITIAL_RELEASE_VERIFICATION_STATUS = "Capture queued";
const INITIAL_RELEASE_VERIFICATION_FRESHNESS =
  "Screenshot capture is queued for the missing CC8.1 evidence.";
const INITIAL_MONITORING_STATUS = "Evidence refresh queued";
const INITIAL_MONITORING_DETAIL =
  "Continuous checks for CC8.1 will rerun after the release approval screenshot lands.";
const ROUTE_BACKED_BROWSER_CAPTURE_STATUS = "Queued";
const ROUTE_BACKED_BROWSER_CAPTURE_DETAIL =
  "Release approval screenshot capture is queued for CC8.1 evidence collection.";
const ROUTE_BACKED_RELEASE_VERIFICATION_STATUS = "Capture queued";
const ROUTE_BACKED_RELEASE_VERIFICATION_FRESHNESS =
  "Screenshot capture is queued for the missing CC8.1 evidence.";
const ROUTE_BACKED_MONITORING_STATUS = "Evidence refresh queued";
const ROUTE_BACKED_MONITORING_DETAIL =
  "Continuous checks for CC8.1 will rerun after the release approval screenshot lands.";
const UNAVAILABLE_BROWSER_CAPTURE_STATUS = "Unavailable";
const UNAVAILABLE_BROWSER_CAPTURE_DETAIL =
  "Conversation thread payload omitted derived evidence state.";
const UNAVAILABLE_RELEASE_VERIFICATION_STATUS = "Unavailable";
const UNAVAILABLE_RELEASE_VERIFICATION_FRESHNESS =
  "Conversation thread payload omitted derived control state.";
const UNAVAILABLE_MONITORING_STATUS = "Unavailable";
const UNAVAILABLE_MONITORING_DETAIL =
  "Monitoring/export state unavailable from the operator route.";

describe("Control Room — Chat Derived State Roundtrip", () => {
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
    await browser
      .getPage()
      .route("**/api/compliance/sprinto/export", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            surface: "operator-control-room-sprinto",
            syncStatus: "succeeded",
            sessionId: "sess-derived-state-roundtrip",
            pushedEntities: 4,
            pushResponse: { accepted: true },
            closeResponse: { mode: "apply" },
          }),
        });
      });

    await browser.getPage().goto(`${getBaseUrl()}/chat/${conversationId}`, {
      waitUntil: "domcontentloaded",
    });

    await waitForSnapshot(
      browser,
      (snap) =>
        /Conversation Thread/i.test(snap.tree) &&
        /Browser Capture/i.test(snap.tree) &&
        /Monitoring Status/i.test(snap.tree) &&
        /CC8\.1 Release Verification/i.test(snap.tree) &&
        new RegExp(INITIAL_BROWSER_CAPTURE_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_MONITORING_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_MONITORING_DETAIL, "i").test(snap.tree) &&
        new RegExp(INITIAL_RELEASE_VERIFICATION_STATUS, "i").test(snap.tree),
      { description: "deep route initial derived panel state" },
    );
  }

  it("round-trips derived browser-capture and release-verification state through the messages route after reload", async () => {
    const conversationId = "conv-derived-roundtrip-" + Date.now();
    await loadConversationRoute(conversationId);
    assertNoErrors(browser);

    await sendChatMessage(browser, "What should I do next for CC8.1?");

    await waitForSnapshot(
      browser,
      (snap) =>
        new RegExp(ROUTE_BACKED_BROWSER_CAPTURE_STATUS, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_MONITORING_STATUS, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_STATUS, "i").test(
          snap.tree,
        ),
      { description: "route-backed derived state before reload" },
    );

    const reloadResponsePromise = browser
      .getPage()
      .waitForResponse((response) =>
        response.url().includes(`/api/conversations/${conversationId}/messages`),
      );

    await browser
      .getPage()
      .getByRole("button", { name: /Reload thread/i })
      .click();

    const reloadResponse = await reloadResponsePromise;
    expect(reloadResponse.status()).toBe(200);

    const reloadedSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /What should I do next for CC8\.1\?/i.test(snap.tree) &&
        new RegExp(ROUTE_BACKED_BROWSER_CAPTURE_STATUS, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_BROWSER_CAPTURE_DETAIL, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_MONITORING_STATUS, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_MONITORING_DETAIL, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_STATUS, "i").test(
          snap.tree,
        ) &&
        new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_FRESHNESS, "i").test(
          snap.tree,
        ),
      { description: "derived state after thread reload" },
    );

    expect(reloadedSnap.tree).toMatch(/Operator Control Room/i);
    expect(reloadedSnap.tree).toMatch(/Conversation Thread/i);
    expect(reloadedSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_BROWSER_CAPTURE_DETAIL, "i"),
    );
    expect(reloadedSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_MONITORING_DETAIL, "i"),
    );
    expect(reloadedSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_FRESHNESS, "i"),
    );
  });

  it("shows an explicit unavailable state when the messages payload omits the derived control-room state", async () => {
    const conversationId = "conv-derived-missing-" + Date.now();
    await loadConversationRoute(conversationId);
    assertNoErrors(browser);

    await sendChatMessage(browser, "What should I do next for CC8.1?");

    await waitForSnapshot(
      browser,
      (snap) =>
        new RegExp(ROUTE_BACKED_BROWSER_CAPTURE_STATUS, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_STATUS, "i").test(
          snap.tree,
        ),
      { description: "route-backed derived state before missing-payload reload" },
    );

    await browser
      .getPage()
      .route(`**/api/conversations/${conversationId}/messages`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            surface: "operator-control-room",
            conversationId,
            messages: [
              {
                id: "msg-gap-summary",
                role: "assistant",
                text: "Missing evidence: incident response walkthrough recording.",
              },
              {
                id: `operator-${conversationId}-1`,
                role: "operator",
                text: "What should I do next for CC8.1?",
              },
              {
                id: `assistant-${conversationId}-2`,
                role: "assistant",
                text: "Route-backed next action: capture the release approval screenshot and resync Sprinto.",
              },
            ],
          }),
        });
      });

    await browser
      .getPage()
      .getByRole("button", { name: /Reload thread/i })
      .click();

    const unavailableSnap = await waitForSnapshot(
      browser,
      (snap) =>
        new RegExp(UNAVAILABLE_BROWSER_CAPTURE_STATUS, "i").test(snap.tree) &&
        new RegExp(UNAVAILABLE_BROWSER_CAPTURE_DETAIL, "i").test(snap.tree) &&
        new RegExp(UNAVAILABLE_MONITORING_STATUS, "i").test(snap.tree) &&
        new RegExp(UNAVAILABLE_MONITORING_DETAIL, "i").test(snap.tree) &&
        new RegExp(UNAVAILABLE_RELEASE_VERIFICATION_STATUS, "i").test(
          snap.tree,
        ) &&
        new RegExp(UNAVAILABLE_RELEASE_VERIFICATION_FRESHNESS, "i").test(
          snap.tree,
        ),
      { description: "explicit unavailable state for missing derived payload" },
    );

    expect(unavailableSnap.tree).toMatch(/Conversation Thread/i);
    expect(unavailableSnap.tree).toMatch(
      new RegExp(UNAVAILABLE_BROWSER_CAPTURE_DETAIL, "i"),
    );
    expect(unavailableSnap.tree).toMatch(
      new RegExp(UNAVAILABLE_MONITORING_DETAIL, "i"),
    );
    expect(unavailableSnap.tree).toMatch(
      new RegExp(UNAVAILABLE_RELEASE_VERIFICATION_FRESHNESS, "i"),
    );
    expect(unavailableSnap.tree).not.toMatch(
      new RegExp(INITIAL_BROWSER_CAPTURE_STATUS, "i"),
    );
    expect(unavailableSnap.tree).not.toMatch(
      new RegExp(INITIAL_MONITORING_STATUS, "i"),
    );
    expect(unavailableSnap.tree).not.toMatch(
      new RegExp(INITIAL_RELEASE_VERIFICATION_STATUS, "i"),
    );
  });
});
