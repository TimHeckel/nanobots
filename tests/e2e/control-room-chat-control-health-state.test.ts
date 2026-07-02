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

const INITIAL_RELEASE_VERIFICATION_STATUS = "At risk";
const INITIAL_RELEASE_VERIFICATION_FRESHNESS = "Missing supporting evidence";
const ROUTE_BACKED_RELEASE_VERIFICATION_STATUS = "Capture queued";
const ROUTE_BACKED_RELEASE_VERIFICATION_FRESHNESS =
  "Screenshot capture is queued for the missing CC8.1 evidence.";
const INITIAL_BROWSER_CAPTURE_STATUS = "Standby";
const INITIAL_BROWSER_CAPTURE_DETAIL =
  "Screenshot and video evidence jobs are not configured yet.";
const INITIAL_MISSING_EVIDENCE =
  "Release verification still lacks a screenshot from the production change window.";
const INITIAL_NEXT_ACTION =
  "Capture a browser-based approval artifact and attach it to CC8.1 before export.";
const DEFAULT_THREAD_CONTROL_ROOM_STATE = {
  nextRecommendedAction: INITIAL_NEXT_ACTION,
  missingEvidence: INITIAL_MISSING_EVIDENCE,
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
    status: INITIAL_RELEASE_VERIFICATION_STATUS,
    freshness: INITIAL_RELEASE_VERIFICATION_FRESHNESS,
  },
} as const;

describe("Control Room — Chat Control Health State", () => {
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
            sessionId: "sess-chat-control-health",
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
            controlRoomState: DEFAULT_THREAD_CONTROL_ROOM_STATE,
          }),
        });
      });

    await browser.getPage().goto(`${getBaseUrl()}/chat/conv-control-gap`, {
      waitUntil: "domcontentloaded",
    });

    await waitForSnapshot(
      browser,
      (snap) =>
        /Conversation Thread/i.test(snap.tree) &&
        /CC8\.1 Release Verification/i.test(snap.tree) &&
        new RegExp(INITIAL_RELEASE_VERIFICATION_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_RELEASE_VERIFICATION_FRESHNESS, "i").test(
          snap.tree,
        ),
      { description: "deep route initial control health state" },
    );
  }

  it("applies a route-backed control-health delta and keeps it across thread reload", async () => {
    await loadConversationRoute();
    assertNoErrors(browser);

    const routeResponsePromise = browser
      .getPage()
      .waitForResponse(
        (response) =>
          response.url().includes("/api/chat") &&
          response.request().method() === "POST",
      );

    await sendChatMessage(browser, "What evidence should I collect first?");

    const routeResponse = await routeResponsePromise;
    expect(routeResponse.status()).toBe(200);

    const updatedSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /What evidence should I collect first\?/i.test(snap.tree) &&
        /CC8\.1 Release Verification/i.test(snap.tree) &&
        new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_STATUS, "i").test(
          snap.tree,
        ) &&
        new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_FRESHNESS, "i").test(
          snap.tree,
        ),
      { description: "route-backed control health delta" },
    );

    expect(updatedSnap.tree).toMatch(/Operator Control Room/i);
    expect(updatedSnap.tree).toMatch(/Control Health/i);
    expect(updatedSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_STATUS, "i"),
    );
    expect(updatedSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_FRESHNESS, "i"),
    );
    expect(updatedSnap.tree).not.toMatch(
      new RegExp(INITIAL_RELEASE_VERIFICATION_STATUS, "i"),
    );

    await browser.getPage().getByRole("button", { name: /Reload thread/i }).click();

    const reloadedSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Conversation Thread/i.test(snap.tree) &&
        new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_STATUS, "i").test(
          snap.tree,
        ) &&
        new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_FRESHNESS, "i").test(
          snap.tree,
        ),
      { description: "control health persists through thread reload" },
    );

    expect(reloadedSnap.tree).toMatch(/Conversation Thread/i);
    expect(reloadedSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_STATUS, "i"),
    );
  });

  it("shows a chat-route failure without mutating any route-backed control-room panels", async () => {
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
        /CC8\.1 Release Verification/i.test(snap.tree) &&
        new RegExp(INITIAL_RELEASE_VERIFICATION_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_RELEASE_VERIFICATION_FRESHNESS, "i").test(
          snap.tree,
        ) &&
        new RegExp(INITIAL_BROWSER_CAPTURE_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_BROWSER_CAPTURE_DETAIL, "i").test(snap.tree) &&
        new RegExp(INITIAL_MISSING_EVIDENCE, "i").test(snap.tree) &&
        new RegExp(INITIAL_NEXT_ACTION, "i").test(snap.tree),
      { description: "chat route failure without route-backed panel mutation" },
    );

    expect(failureSnap.tree).toMatch(/Operator Control Room/i);
    expect(failureSnap.tree).toMatch(/Control Health/i);
    expect(failureSnap.tree).toMatch(/Connected Evidence Sources/i);
    expect(failureSnap.tree).toMatch(/Missing Evidence/i);
    expect(failureSnap.tree).toMatch(/Next Recommended Action/i);
    expect(failureSnap.tree).toMatch(/Chat route failure/i);
    expect(failureSnap.tree).toMatch(
      /Control-room response unavailable\. Retry the operator request\./i,
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_RELEASE_VERIFICATION_STATUS, "i"),
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_RELEASE_VERIFICATION_FRESHNESS, "i"),
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_BROWSER_CAPTURE_STATUS, "i"),
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_BROWSER_CAPTURE_DETAIL, "i"),
    );
    expect(failureSnap.tree).toMatch(new RegExp(INITIAL_MISSING_EVIDENCE, "i"));
    expect(failureSnap.tree).toMatch(new RegExp(INITIAL_NEXT_ACTION, "i"));
    expect(failureSnap.tree).not.toMatch(
      new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_STATUS, "i"),
    );
    expect(failureSnap.tree).not.toMatch(
      new RegExp(ROUTE_BACKED_RELEASE_VERIFICATION_FRESHNESS, "i"),
    );
    expect(failureSnap.tree).not.toMatch(
      /Release approval screenshot capture is queued for CC8\.1 evidence collection\./i,
    );
    expect(failureSnap.tree).not.toMatch(
      /Attach the release approval screenshot to CC8\.1 and rerun the Sprinto sync check\./i,
    );
    expect(failureSnap.tree).not.toMatch(
      /Release verification now needs the release approval screenshot attached to CC8\.1 before Sprinto sync can close\./i,
    );
  });
});
