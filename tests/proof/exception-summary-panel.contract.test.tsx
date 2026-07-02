import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const DEFAULT_RELEASE_EXCEPTION =
  "Release verification control lacks screenshot confirmation.";
const DEFAULT_BROWSER_CAPTURE_EXCEPTION =
  "Browser capture evidence jobs are not configured yet.";
const ROUTE_BACKED_RELEASE_EXCEPTION =
  "Release verification remains open until the queued CC8.1 screenshot lands.";
const ROUTE_BACKED_BROWSER_CAPTURE_EXCEPTION =
  "Browser capture evidence collection is queued for the missing release approval screenshot.";

describe("exception summary panel contract", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock("@/components/control-room/control-room-state");
  });

  it("renders exception cards from shared control-room state instead of the shell defaults", async () => {
    vi.doMock("@/components/control-room/control-room-state", async () => ({
      useOptionalControlRoomState: () => ({
        exceptionSummary: {
          items: [
            ROUTE_BACKED_RELEASE_EXCEPTION,
            ROUTE_BACKED_BROWSER_CAPTURE_EXCEPTION,
          ],
        },
      }),
    }));

    const { ExceptionSummaryPanel } = await import(
      "@/components/control-room/exception-summary-panel"
    );

    const markup = renderToStaticMarkup(<ExceptionSummaryPanel />);

    expect(markup).toContain(ROUTE_BACKED_RELEASE_EXCEPTION);
    expect(markup).toContain(ROUTE_BACKED_BROWSER_CAPTURE_EXCEPTION);
    expect(markup).not.toContain(DEFAULT_RELEASE_EXCEPTION);
    expect(markup).not.toContain(DEFAULT_BROWSER_CAPTURE_EXCEPTION);
  });

  it("falls back to the shared default exception state when no control-room state is available", async () => {
    vi.doMock("@/components/control-room/control-room-state", async () => ({
      useOptionalControlRoomState: () => null,
    }));

    const { ExceptionSummaryPanel } = await import(
      "@/components/control-room/exception-summary-panel"
    );

    const markup = renderToStaticMarkup(<ExceptionSummaryPanel />);

    expect(markup).toContain(DEFAULT_RELEASE_EXCEPTION);
    expect(markup).toContain(DEFAULT_BROWSER_CAPTURE_EXCEPTION);
  });
});
