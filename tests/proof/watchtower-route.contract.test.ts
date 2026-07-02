import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/cron/watchtower/route";
import {
  listSprintoMonitoringFindingsSync,
  listSprintoMonitoringRunsSync,
  resetSprintoMonitoringStore,
} from "@/lib/db/monitoring";

describe("watchtower monitoring route contract", () => {
  beforeEach(() => {
    resetSprintoMonitoringStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSprintoMonitoringStore();
  });

  it("seeds the last-known sprinto baseline and returns persisted monitoring findings on GET", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload).toEqual({
      surface: "operator-control-room-monitoring",
      monitoringStatus: "active",
      controlFreshness: "review-due",
      checkedControls: 4,
      staleControls: 4,
      openExceptions: 2,
      comparedBaselineControls: 4,
      findings: expect.arrayContaining([
        expect.objectContaining({
          finding_type: "stale-control",
          control_key: "NB-CC-001",
        }),
        expect.objectContaining({
          finding_type: "exception-opened",
          control_key: "NB-CC-002",
        }),
      ]),
    });
    expect(listSprintoMonitoringRunsSync("preview-org")).toHaveLength(1);
    expect(listSprintoMonitoringFindingsSync("preview-org")).toHaveLength(12);
  });

  it("reuses the persisted baseline and still produces a monitoring run on POST", async () => {
    await GET();

    const response = await POST();
    const payload = await response.json();

    expect(payload.checkedControls).toBe(4);
    expect(payload.comparedBaselineControls).toBe(4);
    expect(payload.findings).toHaveLength(12);
    expect(listSprintoMonitoringRunsSync("preview-org")).toHaveLength(2);
  });
});
