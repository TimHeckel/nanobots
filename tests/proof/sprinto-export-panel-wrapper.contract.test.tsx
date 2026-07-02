import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSprintoExportPanelState,
  SprintoExportPanel,
} from "@/components/control-room/sprinto-export-panel";

describe("sprinto export panel wrapper contract", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock("@/components/control-room/control-room-state");
  });

  it("summarizes export readiness from local evidence and control counts", () => {
    expect(
      buildSprintoExportPanelState({
        connectedSourceCount: 0,
        readyControlCount: 0,
        blockedControlCount: 0,
        actionRequiredControlCount: 3,
      }),
    ).toEqual({
      exportStatus: "Awaiting evidence sources",
      exportDetail:
        "Connect and sync at least one evidence source before preparing a Sprinto update.",
      lastSyncLabel: "No local export run",
      lastSyncDetail:
        "Sprinto export has not been attempted because the control room has no connected evidence sources yet.",
      updateLabel: "Connect a source first",
      updateDetail:
        "Use the operator conversation to connect GitHub and start evidence collection.",
    });

    expect(
      buildSprintoExportPanelState({
        connectedSourceCount: 1,
        readyControlCount: 3,
        blockedControlCount: 0,
        actionRequiredControlCount: 0,
      }).exportStatus,
    ).toBe("Ready to export");
  });

  it("falls back to the default sync panel state when the control-room provider is absent", async () => {
    vi.doMock("@/components/control-room/control-room-state", async () => {
      const actual = await vi.importActual("@/components/control-room/control-room-state");
      return {
        ...actual,
        useOptionalControlRoomState: () => null,
      };
    });

    const { SprintoExportPanel: UnscopedSprintoExportPanel } = await import(
      "@/components/control-room/sprinto-export-panel"
    );

    const markup = renderToStaticMarkup(<UnscopedSprintoExportPanel />);

    expect(markup).toContain("Awaiting evidence sources");
    expect(markup).toContain("No local export run");
    expect(markup).toContain("Connect a source first");
  });
});
