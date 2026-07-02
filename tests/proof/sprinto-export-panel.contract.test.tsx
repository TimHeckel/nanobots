import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildSprintoExportPanelState,
  SprintoExportPanelView,
} from "@/components/control-room/sprinto-export-panel";

describe("sprinto export panel contract", () => {
  it("renders an honest local empty state before any evidence source is connected", () => {
    const state = buildSprintoExportPanelState({
      connectedSourceCount: 0,
      readyControlCount: 0,
      blockedControlCount: 0,
      actionRequiredControlCount: 3,
    });
    const markup = renderToStaticMarkup(<SprintoExportPanelView state={state} />);

    expect(markup).toContain("Awaiting evidence sources");
    expect(markup).toContain("No local export run");
    expect(markup).toContain("Connect a source first");
  });

  it("renders a truthful action-required state when control gaps still block export", () => {
    const state = buildSprintoExportPanelState({
      connectedSourceCount: 1,
      readyControlCount: 1,
      blockedControlCount: 0,
      actionRequiredControlCount: 2,
    });
    const markup = renderToStaticMarkup(<SprintoExportPanelView state={state} />);

    expect(markup).toContain("Action required");
    expect(markup).toContain("Local state not exportable yet");
    expect(markup).toContain("Resolve gaps before export");
  });

  it("renders a ready state once all controls are exportable", () => {
    const state = buildSprintoExportPanelState({
      connectedSourceCount: 1,
      readyControlCount: 3,
      blockedControlCount: 0,
      actionRequiredControlCount: 0,
    });
    const markup = renderToStaticMarkup(<SprintoExportPanelView state={state} />);

    expect(markup).toContain("Ready to export");
    expect(markup).toContain("No Sprinto push yet");
    expect(markup).toContain("Export can proceed");
  });
});
