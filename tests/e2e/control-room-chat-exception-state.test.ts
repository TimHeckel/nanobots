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

const INITIAL_EXCEPTION_RELEASE =
  "Release verification remains open until the queued CC8.1 screenshot lands.";
const INITIAL_EXCEPTION_BROWSER_CAPTURE =
  "Browser capture evidence collection is queued for the missing release approval screenshot.";
const ROUTE_BACKED_EXCEPTION_RELEASE =
  "Release verification remains open until the queued CC8.1 screenshot lands.";
const ROUTE_BACKED_EXCEPTION_BROWSER_CAPTURE =
  "Browser capture evidence collection is queued for the missing release approval screenshot.";
const INITIAL_BROWSER_CAPTURE_STATUS = "Queued";
const INITIAL_BROWSER_CAPTURE_DETAIL =
  "Release approval screenshot capture is queued for CC8.1 evidence collection.";
const INITIAL_MONITORING_STATUS = "Evidence refresh queued";
const INITIAL_MONITORING_DETAIL =
  "Continuous checks for CC8.1 will rerun after the release approval screenshot lands.";
const INITIAL_RELEASE_VERIFICATION_STATUS = "Capture queued";
const INITIAL_RELEASE_VERIFICATION_FRESHNESS =
  "Screenshot capture is queued for the missing CC8.1 evidence.";
const INITIAL_MISSING_EVIDENCE =
  "Release verification now needs the release approval screenshot attached to CC8.1 before Sprinto sync can close.";
const INITIAL_NEXT_ACTION =
  "Attach the release approval screenshot to CC8.1 and rerun the Sprinto sync check.";

describe("Control Room — Chat Exception State", () => {
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

  function buildConversationId(suffix: string) {
    return `conv-chat-exception-state-${suffix}-${Date.now()}`;
  }

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
            sessionId: "sess-chat-exception-state",
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
        /Missing evidence: incident response walkthrough recording\./i.test(
          snap.tree,
        ) &&
        /Exceptions/i.test(snap.tree) &&
        new RegExp(INITIAL_EXCEPTION_RELEASE, "i").test(snap.tree) &&
        new RegExp(INITIAL_EXCEPTION_BROWSER_CAPTURE, "i").test(snap.tree),
      { description: "deep route initial exception state" },
    );
  }

  it("updates the exception summary panel after a successful live chat turn", async () => {
    const conversationId = buildConversationId("success");
    await loadConversationRoute(conversationId);
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

    const successSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Route-backed next action: capture the release approval screenshot and resync Sprinto\./i.test(
          snap.tree,
        ) &&
        new RegExp(ROUTE_BACKED_EXCEPTION_RELEASE, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_EXCEPTION_BROWSER_CAPTURE, "i").test(
          snap.tree,
        ),
      { description: "route-backed exception summary update" },
    );

    expect(successSnap.tree).toMatch(/Operator Control Room/i);
    expect(successSnap.tree).toMatch(/Conversation Thread/i);
    expect(successSnap.tree).toMatch(/Exceptions/i);
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_EXCEPTION_RELEASE, "i"),
    );
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_EXCEPTION_BROWSER_CAPTURE, "i"),
    );

    await browser.getPage().getByRole("button", { name: /Reload thread/i }).click();

    const reloadedSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Conversation Thread/i.test(snap.tree) &&
        new RegExp(ROUTE_BACKED_EXCEPTION_RELEASE, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_EXCEPTION_BROWSER_CAPTURE, "i").test(
          snap.tree,
        ),
      { description: "route-backed exception summary survives thread reload" },
    );

    expect(reloadedSnap.tree).toMatch(/Conversation Thread/i);
    expect(reloadedSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_EXCEPTION_RELEASE, "i"),
    );
    expect(reloadedSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_EXCEPTION_BROWSER_CAPTURE, "i"),
    );
  });

  it("shows an auditable failure without mutating any route-backed panels", async () => {
    const conversationId = buildConversationId("failure");
    await loadConversationRoute(conversationId);
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
        new RegExp(INITIAL_EXCEPTION_RELEASE, "i").test(snap.tree) &&
        new RegExp(INITIAL_EXCEPTION_BROWSER_CAPTURE, "i").test(snap.tree) &&
        new RegExp(INITIAL_BROWSER_CAPTURE_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_BROWSER_CAPTURE_DETAIL, "i").test(snap.tree) &&
        new RegExp(INITIAL_MONITORING_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_MONITORING_DETAIL, "i").test(snap.tree) &&
        new RegExp(INITIAL_RELEASE_VERIFICATION_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_RELEASE_VERIFICATION_FRESHNESS, "i").test(
          snap.tree,
        ) &&
        new RegExp(INITIAL_MISSING_EVIDENCE, "i").test(snap.tree) &&
        new RegExp(INITIAL_NEXT_ACTION, "i").test(snap.tree),
      { description: "chat route failure without route-backed panel mutation" },
    );

    expect(failureSnap.tree).toMatch(/Operator Control Room/i);
    expect(failureSnap.tree).toMatch(/Conversation Thread/i);
    expect(failureSnap.tree).toMatch(/Exceptions/i);
    expect(failureSnap.tree).toMatch(/Chat route failure/i);
    expect(failureSnap.tree).toMatch(
      /Control-room response unavailable\. Retry the operator request\./i,
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_EXCEPTION_RELEASE, "i"),
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_EXCEPTION_BROWSER_CAPTURE, "i"),
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_BROWSER_CAPTURE_STATUS, "i"),
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_BROWSER_CAPTURE_DETAIL, "i"),
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_MONITORING_STATUS, "i"),
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_MONITORING_DETAIL, "i"),
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_RELEASE_VERIFICATION_STATUS, "i"),
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_RELEASE_VERIFICATION_FRESHNESS, "i"),
    );
    expect(failureSnap.tree).toMatch(new RegExp(INITIAL_MISSING_EVIDENCE, "i"));
    expect(failureSnap.tree).toMatch(new RegExp(INITIAL_NEXT_ACTION, "i"));
  });
});
