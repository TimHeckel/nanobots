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
const ROUTE_BACKED_ASSISTANT_REPLY =
  "Route-backed next action: capture the release approval screenshot and resync Sprinto.";

describe("Control Room — Chat Entry Evidence Sources State", () => {
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
            sessionId: "sess-chat-evidence-sources",
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
        /Connected Evidence Sources/i.test(snap.tree) &&
        /Conversation Panel/i.test(snap.tree) &&
        /Browser Capture/i.test(snap.tree) &&
        new RegExp(INITIAL_BROWSER_CAPTURE_STATUS, "i").test(snap.tree) &&
        new RegExp(INITIAL_BROWSER_CAPTURE_DETAIL, "i").test(snap.tree),
      { description: "chat entry route initial evidence-source state" },
    );
  }

  it("updates one evidence-source panel after a successful live chat turn on /chat", async () => {
    await loadChatEntryRoute();
    assertNoErrors(browser);

    await sendChatMessage(browser, "What evidence should I collect first?");

    const successSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /What evidence should I collect first\?/i.test(snap.tree) &&
        new RegExp(ROUTE_BACKED_ASSISTANT_REPLY, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_BROWSER_CAPTURE_STATUS, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_BROWSER_CAPTURE_DETAIL, "i").test(snap.tree),
      { description: "route-backed evidence-source update on chat entry" },
    );

    expect(successSnap.tree).toMatch(/Operator Control Room/i);
    expect(successSnap.tree).toMatch(/Conversation Panel/i);
    expect(successSnap.tree).toMatch(/Connected Evidence Sources/i);
    expect(successSnap.tree).toMatch(/Browser Capture/i);
    expect(successSnap.tree).toMatch(/What evidence should I collect first\?/i);
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_ASSISTANT_REPLY, "i"),
    );
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

  it("shows an auditable failure on /chat without mutating the evidence-source panel", async () => {
    await loadChatEntryRoute();
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
      { description: "chat route failure without evidence-source mutation" },
    );

    expect(failureSnap.tree).toMatch(/Operator Control Room/i);
    expect(failureSnap.tree).toMatch(/Conversation Panel/i);
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
