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

const INITIAL_NEXT_ACTION =
  "Capture a browser-based approval artifact and attach it to CC8.1 before export.";
const ROUTE_BACKED_NEXT_ACTION =
  "Attach the release approval screenshot to CC8.1 and rerun the Sprinto sync check.";
const ROUTE_BACKED_ASSISTANT_REPLY =
  "Route-backed next action: capture the release approval screenshot and resync Sprinto.";

describe("Control Room — Chat Entry Panel State", () => {
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
    await browser
      .getPage()
      .route("**/api/compliance/sprinto/export", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            surface: "operator-control-room-sprinto",
            syncStatus: "succeeded",
            sessionId: "sess-chat-panel-state",
            pushedEntities: 4,
            pushResponse: { accepted: true },
            closeResponse: { mode: "apply" },
          }),
        });
      });

    await browser.getPage().goto(`${getBaseUrl()}/chat`, {
      waitUntil: "domcontentloaded",
    });

    await waitForSnapshot(
      browser,
      (snap) =>
        /sess-chat-panel-state/i.test(snap.tree) &&
        /Conversation Panel/i.test(snap.tree) &&
        new RegExp(INITIAL_NEXT_ACTION, "i").test(snap.tree),
      { description: "chat entry route initial panel state" },
    );
  }

  it("renders a successful chat turn and applies one visible side-panel delta on /chat", async () => {
    await loadChatEntryRoute();
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

    const panelSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /What evidence should I collect first\?/i.test(snap.tree) &&
        new RegExp(ROUTE_BACKED_ASSISTANT_REPLY, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_NEXT_ACTION, "i").test(snap.tree),
      { description: "route-backed chat turn with panel delta on chat entry" },
    );

    expect(panelSnap.tree).toMatch(/Operator Control Room/i);
    expect(panelSnap.tree).toMatch(/Conversation Panel/i);
    expect(panelSnap.tree).toMatch(/What evidence should I collect first\?/i);
    expect(panelSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_ASSISTANT_REPLY, "i"),
    );
    expect(panelSnap.tree).toMatch(/Next Recommended Action/i);
    expect(panelSnap.tree).toMatch(new RegExp(ROUTE_BACKED_NEXT_ACTION, "i"));
    expect(panelSnap.tree).not.toMatch(new RegExp(INITIAL_NEXT_ACTION, "i"));
  });

  it("shows an auditable failure on /chat without mutating the side panel", async () => {
    await loadChatEntryRoute();
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
        ) && new RegExp(INITIAL_NEXT_ACTION, "i").test(snap.tree),
      { description: "chat route failure without panel mutation" },
    );

    expect(failureSnap.tree).toMatch(/Operator Control Room/i);
    expect(failureSnap.tree).toMatch(/Conversation Panel/i);
    expect(failureSnap.tree).toMatch(/Chat route failure/i);
    expect(failureSnap.tree).toMatch(
      /Control-room response unavailable\. Retry the operator request\./i,
    );
    expect(failureSnap.tree).toMatch(new RegExp(INITIAL_NEXT_ACTION, "i"));
    expect(failureSnap.tree).not.toMatch(
      new RegExp(ROUTE_BACKED_NEXT_ACTION, "i"),
    );
  });
});
