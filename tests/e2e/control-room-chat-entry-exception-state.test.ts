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
  "Release verification control lacks screenshot confirmation.";
const INITIAL_EXCEPTION_BROWSER_CAPTURE =
  "Browser capture evidence jobs are not configured yet.";
const ROUTE_BACKED_EXCEPTION_RELEASE =
  "Release verification remains open until the queued CC8.1 screenshot lands.";
const ROUTE_BACKED_EXCEPTION_BROWSER_CAPTURE =
  "Browser capture evidence collection is queued for the missing release approval screenshot.";
const ROUTE_BACKED_ASSISTANT_REPLY =
  "Route-backed next action: capture the release approval screenshot and resync Sprinto.";

describe("Control Room — Chat Entry Exception State", () => {
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
            sessionId: "sess-chat-entry-exception-state",
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
        /Exceptions/i.test(snap.tree) &&
        new RegExp(INITIAL_EXCEPTION_RELEASE, "i").test(snap.tree) &&
        new RegExp(INITIAL_EXCEPTION_BROWSER_CAPTURE, "i").test(snap.tree),
      { description: "chat entry initial exception state" },
    );
  }

  it("updates the exception card after a successful live chat turn on /chat", async () => {
    await loadChatEntryRoute();
    assertNoErrors(browser);

    await sendChatMessage(browser, "What should I do next for CC8.1?");

    const successSnap = await waitForSnapshot(
      browser,
      (snap) =>
        new RegExp(ROUTE_BACKED_ASSISTANT_REPLY, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_EXCEPTION_RELEASE, "i").test(snap.tree) &&
        new RegExp(ROUTE_BACKED_EXCEPTION_BROWSER_CAPTURE, "i").test(
          snap.tree,
        ),
      { description: "route-backed exception update on chat entry" },
    );

    expect(successSnap.tree).toMatch(/Operator Control Room/i);
    expect(successSnap.tree).toMatch(/Conversation Panel/i);
    expect(successSnap.tree).toMatch(/Exceptions/i);
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_ASSISTANT_REPLY, "i"),
    );
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_EXCEPTION_RELEASE, "i"),
    );
    expect(successSnap.tree).toMatch(
      new RegExp(ROUTE_BACKED_EXCEPTION_BROWSER_CAPTURE, "i"),
    );
    expect(successSnap.tree).not.toMatch(
      new RegExp(INITIAL_EXCEPTION_RELEASE, "i"),
    );
    expect(successSnap.tree).not.toMatch(
      new RegExp(INITIAL_EXCEPTION_BROWSER_CAPTURE, "i"),
    );
  });

  it("shows an auditable failure without mutating the exception card on /chat", async () => {
    await loadChatEntryRoute();
    assertNoErrors(browser);

    await sendChatMessage(browser, "force chat route failure");

    const failureSnap = await waitForSnapshot(
      browser,
      (snap) =>
        /Control-room response unavailable\. Retry the operator request\./i.test(
          snap.tree,
        ) &&
        new RegExp(INITIAL_EXCEPTION_RELEASE, "i").test(snap.tree) &&
        new RegExp(INITIAL_EXCEPTION_BROWSER_CAPTURE, "i").test(snap.tree),
      { description: "chat route failure without exception mutation" },
    );

    expect(failureSnap.tree).toMatch(/Operator Control Room/i);
    expect(failureSnap.tree).toMatch(/Conversation Panel/i);
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
    expect(failureSnap.tree).not.toMatch(
      new RegExp(ROUTE_BACKED_EXCEPTION_RELEASE, "i"),
    );
    expect(failureSnap.tree).not.toMatch(
      new RegExp(ROUTE_BACKED_EXCEPTION_BROWSER_CAPTURE, "i"),
    );
  });
});
