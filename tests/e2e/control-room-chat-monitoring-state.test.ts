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

const INITIAL_MONITORING_STATUS = "Preview mode";
const INITIAL_MONITORING_DETAIL =
  "Continuous checks are represented with stable mock timing only.";
const ROUTE_BACKED_MONITORING_STATUS = "Evidence refresh queued";
const ROUTE_BACKED_MONITORING_DETAIL =
  "Continuous checks for CC8.1 will rerun after the release approval screenshot lands.";
const ROUTE_BACKED_ASSISTANT_REPLY =
  "Route-backed next action: capture the release approval screenshot and resync Sprinto.";

describe("Control Room — Chat Monitoring State", () => {
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
            sessionId: "sess-chat-monitoring-state",
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
        /Operator Control Room/i.test(snap.tree) &&
        /Monitoring Status/i.test(snap.tree) &&
        new RegExp(INITIAL_MONITORING_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_MONITORING_DETAIL, "i").test(snap.tree),
      { description: "chat entry route initial monitoring state" },
    );
  }

  it("updates the monitoring status panel after a successful live chat turn", async () => {
    await loadChatEntryRoute();
    assertNoErrors(browser);

    await sendChatMessage(browser, "What monitoring should happen after CC8.1 evidence is attached?");

    const successSnap = await waitForSnapshot(
      browser,
      (snap) =>
        new RegExp(ROUTE_BACKED_ASSISTANT_REPLY, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_MONITORING_STATUS, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_MONITORING_DETAIL, "i").test(snap.tree),
      { description: "route-backed monitoring panel update" },
    );

    expect(successSnap.tree).toMatch(/Operator Control Room/i);
    expect(successSnap.tree).toMatch(/Conversation Panel/i);
    expect(successSnap.tree).toMatch(/Monitoring Status/i);
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_ASSISTANT_REPLY, "i"),
    );
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_MONITORING_STATUS, "i"),
    );
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_MONITORING_DETAIL, "i"),
    );
    expect(successSnap.tree).not.toMatch(
      new RegExp(INITIAL_MONITORING_STATUS, "i"),
    );
    expect(successSnap.tree).not.toMatch(
      new RegExp(INITIAL_MONITORING_DETAIL, "i"),
    );
  });

  it("shows an auditable failure without mutating the monitoring status panel", async () => {
    await loadChatEntryRoute();
    assertNoErrors(browser);

    await sendChatMessage(browser, "force chat route failure");

    const failureSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Control-room response unavailable\. Retry the operator request\./i.test(
          snap.tree,
        ) &&
        new RegExp(INITIAL_MONITORING_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_MONITORING_DETAIL, "i").test(snap.tree),
      { description: "chat route failure without monitoring mutation" },
    );

    expect(failureSnap.tree).toMatch(/Operator Control Room/i);
    expect(failureSnap.tree).toMatch(/Conversation Panel/i);
    expect(failureSnap.tree).toMatch(/Chat route failure/i);
    expect(failureSnap.tree).toMatch(
      /Control-room response unavailable\. Retry the operator request\./i,
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_MONITORING_STATUS, "i"),
    );
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_MONITORING_DETAIL, "i"),
    );
    expect(failureSnap.tree).not.toMatch(
      new RegExp(ROUTE_BACKED_MONITORING_STATUS, "i"),
    );
    expect(failureSnap.tree).not.toMatch(
      new RegExp(ROUTE_BACKED_MONITORING_DETAIL, "i"),
    );
  });
});
