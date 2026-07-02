import { describe, expect, it } from "vitest";
import { showStatsToolDef } from "@/lib/chat/tools/show-stats";

describe("show stats tool contract", () => {
  it("returns the minimal control-room stats payload", async () => {
    const tool = showStatsToolDef("org_1");

    expect(tool.description).toContain("scan statistics");

    await expect(tool.execute({})).resolves.toEqual({
      orgId: "org_1",
      connectedSources: 3,
      mappedControls: 12,
      staleControls: 2,
      openExceptions: 1,
      lastSprintoSyncAt: "2026-03-26T12:00:00.000Z",
    });
  });
});
