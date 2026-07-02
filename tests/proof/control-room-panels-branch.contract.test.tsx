import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("control-room panel branch coverage", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock("@/components/control-room/control-room-state");
  });

  describe("ControlHealthPanel", () => {
    it("resolves CC8.1 release verification from control-room state", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => {
        const actual = await vi.importActual("@/components/control-room/control-room-state");
        return {
          ...actual,
          useOptionalControlRoomState: () => ({
            releaseVerificationStatus: "Capture queued",
            releaseVerificationFreshness: "Set from operator route",
          }),
        };
      });

      const { ControlHealthPanel } = await import(
        "@/components/control-room/control-health-panel"
      );

      const markup = renderToStaticMarkup(<ControlHealthPanel />);

      expect(markup).toContain("Capture queued");
      expect(markup).toContain("Set from operator route");
    });

    it("falls back to static defaults when control-room state is null", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => {
        const actual = await vi.importActual("@/components/control-room/control-room-state");
        return {
          ...actual,
          useOptionalControlRoomState: () => null,
        };
      });

      const { ControlHealthPanel } = await import(
        "@/components/control-room/control-health-panel"
      );

      const markup = renderToStaticMarkup(<ControlHealthPanel />);

      expect(markup).toContain("CC8.1");
      expect(markup).toContain("Action required");
    });

    it("renders export statuses from the sync panel when source-backed state exists", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => {
        const actual = await vi.importActual("@/components/control-room/control-room-state");
        return {
          ...actual,
          useOptionalControlRoomState: () => ({
            syncPanelState: {
              connectedSources: [],
              syncHealth: {
                value: "Healthy",
                detail: "All sources synced",
              },
              controlExportStatuses: [
                {
                  controlId: "CC7.2",
                  status: "Ready",
                  detail: "Latest evidence for CC7.2 is ready for Sprinto export.",
                },
              ],
            },
          }),
        };
      });

      const { ControlHealthPanel } = await import(
        "@/components/control-room/control-health-panel"
      );

      const markup = renderToStaticMarkup(<ControlHealthPanel />);

      expect(markup).toContain("CC7.2");
      expect(markup).toContain("Ready");
      expect(markup).toContain("ready for Sprinto export");
    });
  });

  describe("ControlMappingsPanel", () => {
    it("resolves CC8.1 mapping note from control-room state", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => ({
        useOptionalControlRoomState: () => ({
          cc81ControlMapping: { note: "Route-backed mapping note" },
        }),
      }));

      const { ControlMappingsPanel } = await import(
        "@/components/control-room/control-mappings-panel"
      );

      const markup = renderToStaticMarkup(<ControlMappingsPanel />);

      expect(markup).toContain("Route-backed mapping note");
    });

    it("falls back to default mapping when control-room state is null", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => ({
        useOptionalControlRoomState: () => null,
      }));

      const { ControlMappingsPanel } = await import(
        "@/components/control-room/control-mappings-panel"
      );

      const markup = renderToStaticMarkup(<ControlMappingsPanel />);

      expect(markup).toContain("CC8.1");
      expect(markup).toContain("Provable Middle");
    });
  });

  describe("EvidenceSourcesGrid", () => {
    it("resolves browser capture state from control-room state", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => {
        const actual = await vi.importActual("@/components/control-room/control-room-state");
        return {
          ...actual,
          useOptionalControlRoomState: () => ({
            browserCapture: { status: "Queued", detail: "Route-backed capture detail" },
          }),
        };
      });

      const { EvidenceSourcesGrid } = await import(
        "@/components/control-room/evidence-sources-grid"
      );

      const markup = renderToStaticMarkup(<EvidenceSourcesGrid />);

      expect(markup).toContain("Queued");
      expect(markup).toContain("Route-backed capture detail");
    });

    it("falls back to default browser capture when control-room state is null", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => {
        const actual = await vi.importActual("@/components/control-room/control-room-state");
        return {
          ...actual,
          useOptionalControlRoomState: () => null,
        };
      });

      const { EvidenceSourcesGrid } = await import(
        "@/components/control-room/evidence-sources-grid"
      );

      const markup = renderToStaticMarkup(<EvidenceSourcesGrid />);

      expect(markup).toContain("Browser Capture");
      expect(markup).toContain("No evidence sources connected");
    });

    it("renders connected evidence sources from the sync panel", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => ({
        useOptionalControlRoomState: () => ({
          browserCapture: { status: "Standby", detail: "capture detail" },
          syncPanelState: {
            connectedSources: [
              {
                sourceId: "github:acme/api",
                name: "GitHub acme/api",
                status: "Synced",
                detail: "5 evidence artifacts normalized from acme/api.",
                lastSyncLabel: "Last sync 2026-03-29T12:15:00.000Z",
              },
            ],
            syncHealth: { value: "Healthy", detail: "All connected sources are synced." },
            controlExportStatuses: [],
          },
        }),
      }));

      const { EvidenceSourcesGrid } = await import(
        "@/components/control-room/evidence-sources-grid"
      );

      const markup = renderToStaticMarkup(<EvidenceSourcesGrid />);

      expect(markup).toContain("GitHub acme/api");
      expect(markup).toContain("Last sync 2026-03-29T12:15:00.000Z");
      expect(markup).toContain("Browser Capture");
    });
  });

  describe("GapResolutionPreviewGrid", () => {
    it("resolves gap resolution state from control-room state", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => {
        const actual = await vi.importActual("@/components/control-room/control-room-state");
        return {
          ...actual,
          useOptionalControlRoomState: () => ({
            nextRecommendedAction: "Attach the screenshot now",
            missingEvidence: "Release approval screenshot still missing",
          }),
        };
      });

      const { GapResolutionPreviewGrid } = await import(
        "@/components/control-room/gap-resolution-preview-grid"
      );

      const markup = renderToStaticMarkup(<GapResolutionPreviewGrid />);

      expect(markup).toContain("Attach the screenshot now");
      expect(markup).toContain("Release approval screenshot still missing");
    });

    it("falls back to defaults when control-room state is null", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => {
        const actual = await vi.importActual("@/components/control-room/control-room-state");
        return {
          ...actual,
          useOptionalControlRoomState: () => null,
        };
      });

      const { GapResolutionPreviewGrid } = await import(
        "@/components/control-room/gap-resolution-preview-grid"
      );

      const markup = renderToStaticMarkup(<GapResolutionPreviewGrid />);

      expect(markup).toContain("Resolve Evidence Gap");
      expect(markup).toContain("Missing Evidence");
    });
  });

  describe("MonitoringSummaryPanel", () => {
    it("resolves monitoring export status from control-room state", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => {
        const actual = await vi.importActual("@/components/control-room/control-room-state");
        return {
          ...actual,
          useOptionalControlRoomState: () => ({
            monitoringExportStatus: { phase: "evidence-refresh-queued", controlId: "CC8.1" },
          }),
        };
      });

      const { MonitoringSummaryPanel } = await import(
        "@/components/control-room/monitoring-summary-panel"
      );

      const markup = renderToStaticMarkup(<MonitoringSummaryPanel />);

      expect(markup).toContain("Evidence refresh queued");
    });

    it("falls back to default monitoring export status when control-room state is null", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => {
        const actual = await vi.importActual("@/components/control-room/control-room-state");
        return {
          ...actual,
          useOptionalControlRoomState: () => null,
        };
      });

      const { MonitoringSummaryPanel } = await import(
        "@/components/control-room/monitoring-summary-panel"
      );

      const markup = renderToStaticMarkup(<MonitoringSummaryPanel />);

      expect(markup).toContain("Monitoring Status");
    });

    it("renders sync health from source-backed panel state", async () => {
      vi.doMock("@/components/control-room/control-room-state", async () => ({
        useOptionalControlRoomState: () => ({
          monitoringExportStatus: { phase: "preview", controlId: null },
          syncPanelState: {
            connectedSources: [],
            syncHealth: {
              value: "Attention required",
              detail: "4 mapped evidence artifacts are ready; 1 artifact requires operator mapping.",
            },
            controlExportStatuses: [],
          },
        }),
      }));

      const { MonitoringSummaryPanel } = await import(
        "@/components/control-room/monitoring-summary-panel"
      );

      const markup = renderToStaticMarkup(<MonitoringSummaryPanel />);

      expect(markup).toContain("Sync Health");
      expect(markup).toContain("Attention required");
      expect(markup).toContain("requires operator mapping");
    });
  });
});
