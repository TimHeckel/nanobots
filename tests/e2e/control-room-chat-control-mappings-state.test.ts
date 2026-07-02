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

const INITIAL_CONTROL_MAPPING_NOTE =
  "Every export preview keeps the evidence chain visible before sync.";
const ROUTE_BACKED_CONTROL_MAPPING_NOTE =
  "Release approval screenshot will be attached to the CC8.1 Sprinto mapping before export sync.";
const ROUTE_BACKED_ASSISTANT_REPLY =
  "Route-backed next action: capture the release approval screenshot and resync Sprinto.";

describe("Control Room — Chat Control Mapping State", () => {
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
            sessionId: "sess-chat-control-mapping-state",
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
        /Conversation Panel/i.test(snap.tree) &&
        /Sprinto Control Mapping/i.test(snap.tree) &&
        /Provable Middle/i.test(snap.tree) &&
        new RegExp(INITIAL_CONTROL_MAPPING_NOTE, "i").test(snap.tree),
      { description: "chat entry route initial control-mapping state" },
    );
  }

  it("updates the CC8.1 control-mapping card after a successful live chat turn", async () => {
    await loadChatEntryRoute();
    assertNoErrors(browser);

    await sendChatMessage(
      browser,
      "What mapping should happen after the release approval screenshot is queued?",
    );

    const successSnap = await waitForSnapshot(
      browser,
      (snap) =>
        new RegExp(ROUTE_BACKED_ASSISTANT_REPLY, "i").test(snap.tree) &&
        /Provable Middle/i.test(snap.tree) &&
        new RegExp(ROUTE_BACKED_CONTROL_MAPPING_NOTE, "i").test(snap.tree),
      { description: "route-backed control-mapping panel update" },
    );

    expect(successSnap.tree).toMatch(/Operator Control Room/i);
    expect(successSnap.tree).toMatch(/Conversation Panel/i);
    expect(successSnap.tree).toMatch(/Sprinto Control Mapping/i);
    expect(successSnap.tree).toMatch(/Provable Middle/i);
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_ASSISTANT_REPLY, "i"),
    );
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_CONTROL_MAPPING_NOTE, "i"),
    );
    expect(successSnap.tree).not.toMatch(
      new RegExp(INITIAL_CONTROL_MAPPING_NOTE, "i"),
    );
  });

  it("shows an auditable failure without mutating the CC8.1 control-mapping card", async () => {
    await loadChatEntryRoute();
    assertNoErrors(browser);

    await sendChatMessage(browser, "force chat route failure");

    const failureSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Control-room response unavailable\. Retry the operator request\./i.test(
          snap.tree,
        ) &&
        /Provable Middle/i.test(snap.tree) &&
        new RegExp(INITIAL_CONTROL_MAPPING_NOTE, "i").test(snap.tree),
      { description: "chat route failure without control-mapping mutation" },
    );

    expect(failureSnap.tree).toMatch(/Operator Control Room/i);
    expect(failureSnap.tree).toMatch(/Conversation Panel/i);
    expect(failureSnap.tree).toMatch(/Chat route failure/i);
    expect(failureSnap.tree).toMatch(
      /Control-room response unavailable\. Retry the operator request\./i,
    );
    expect(failureSnap.tree).toMatch(/Provable Middle/i);
    expect(failureSnap.tree).toMatch(
      new RegExp(INITIAL_CONTROL_MAPPING_NOTE, "i"),
    );
    expect(failureSnap.tree).not.toMatch(
      new RegExp(ROUTE_BACKED_CONTROL_MAPPING_NOTE, "i"),
    );
  });
});
