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

const INITIAL_BROWSER_CAPTURE_STATUS = "Standby";
const INITIAL_BROWSER_CAPTURE_DETAIL =
  "Screenshot and video evidence jobs are not configured yet.";
const ROUTE_BACKED_BROWSER_CAPTURE_STATUS = "Queued";
const ROUTE_BACKED_BROWSER_CAPTURE_DETAIL =
  "Release approval screenshot capture is queued for CC8.1 evidence collection.";
const DEFAULT_CONTROL_ROOM_STATE = {
  nextRecommendedAction:
    "Capture a browser-based approval artifact and attach it to CC8.1 before export.",
  missingEvidence:
    "Release verification still lacks a screenshot from the production change window.",
  browserCapture: {
    status: INITIAL_BROWSER_CAPTURE_STATUS,
    detail: INITIAL_BROWSER_CAPTURE_DETAIL,
  },
  monitoringExportStatus: {
    phase: "preview",
    controlId: null,
  },
  cc81ControlMapping: {
    note: "Every export preview keeps the evidence chain visible before sync.",
  },
  exceptionSummary: {
    items: [
      "Release verification control lacks screenshot confirmation.",
      "Browser capture evidence jobs are not configured yet.",
    ],
  },
  releaseVerification: {
    status: "At risk",
    freshness: "Missing supporting evidence",
  },
} as const;

describe("Control Room — Chat Browser Capture State", () => {
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
            sessionId: "sess-chat-browser-capture",
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
            controlRoomState: DEFAULT_CONTROL_ROOM_STATE,
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
        ) &&
        /Browser Capture/i.test(snap.tree) &&
        new RegExp(INITIAL_BROWSER_CAPTURE_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_BROWSER_CAPTURE_DETAIL, "i").test(snap.tree),
      { description: "conversation route initial browser-capture state" },
    );
  }

  it("updates the browser capture evidence panel after a successful live chat turn", async () => {
    await loadConversationRoute();
    assertNoErrors(browser);

    await sendChatMessage(browser, "What should I do next for CC8.1?");

    const successSnap = await waitForSnapshot(
      browser,
      (snap) =>
        new RegExp(ROUTE_BACKED_BROWSER_CAPTURE_STATUS, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_BROWSER_CAPTURE_DETAIL, "i").test(snap.tree),
      { description: "route-backed browser-capture state update" },
    );

    expect(successSnap.tree).toMatch(/Connected Evidence Sources/i);
    expect(successSnap.tree).toMatch(/Browser Capture/i);
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_BROWSER_CAPTURE_STATUS, "i"),
    );
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_BROWSER_CAPTURE_DETAIL, "i"),
    );
    expect(successSnap.tree).not.toMatch(
      new RegExp(INITIAL_BROWSER_CAPTURE_DETAIL, "i"),
    );
  });

  it("shows an auditable failure without mutating the browser capture evidence panel", async () => {
    await loadConversationRoute();
    assertNoErrors(browser);

    await sendChatMessage(browser, "force chat route failure");

    const failureSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Control-room response unavailable\. Retry the operator request\./i.test(
          snap.tree,
        ) &&
        new RegExp(INITIAL_BROWSER_CAPTURE_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_BROWSER_CAPTURE_DETAIL, "i").test(snap.tree),
      { description: "chat route failure without browser-capture mutation" },
    );

    expect(failureSnap.tree).toMatch(/Connected Evidence Sources/i);
    expect(failureSnap.tree).toMatch(/Browser Capture/i);
    expect(failureSnap.tree).toMatch(/Chat route failure/i);
    expect(failureSnap.tree).toMatch(
      /Control-room response unavailable\. Retry the operator request\./i,
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_BROWSER_CAPTURE_STATUS, "i"),
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_BROWSER_CAPTURE_DETAIL, "i"),
    );
    expect(failureSnap.tree).not.toMatch(
      new RegExp(ROUTE_BACKED_BROWSER_CAPTURE_DETAIL, "i"),
    );
  });
});
