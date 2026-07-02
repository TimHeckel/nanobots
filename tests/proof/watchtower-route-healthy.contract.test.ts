import { afterEach, describe, expect, it, vi } from "vitest";

describe("watchtower monitoring route healthy branch", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock("@/lib/compliance/monitoring");
    vi.unmock("@/lib/db/monitoring");
  });

  it("returns a healthy freshness summary when the monitoring run has no stale controls", async () => {
    vi.doMock("@/lib/compliance/monitoring", () => ({
      recordSprintoExportBaseline: vi.fn(),
      runSprintoMonitoringLoop: vi.fn(async () => ({
        run: {
          id: "run_healthy",
          org_id: "preview-org",
          checked_at: "2026-03-29T12:00:00.000Z",
          controls_checked: 4,
          stale_controls: 0,
          open_exceptions: 0,
          findings_count: 0,
        },
        findings: [],
        comparedBaselineControls: 4,
      })),
    }));
    vi.doMock("@/lib/db/monitoring", () => ({
      loadSprintoControlBaselinesFromDb: vi.fn(async () => [
        { external_id: "seeded:NB-CC-001" },
      ]),
    }));

    const { GET } = await import("@/app/api/cron/watchtower/route");
    const response = await GET();
    const payload = await response.json();

    expect(payload.controlFreshness).toBe("healthy");
    expect(payload.staleControls).toBe(0);
    expect(payload.findings).toEqual([]);
  });
});
