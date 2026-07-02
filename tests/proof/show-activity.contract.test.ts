import { describe, expect, it } from "vitest";
import { showActivityToolDef } from "@/lib/chat/tools/show-activity";

describe("show activity tool contract", () => {
  it("returns the minimal control-room activity feed states", async () => {
    const tool = showActivityToolDef("org_1");

    expect(tool.description).toContain("activity feed");

    await expect(tool.execute({ limit: 1 })).resolves.toEqual([
      {
        orgId: "org_1",
        eventType: "evidence.updated",
        summary: "GitHub evidence synced for CC6.1",
        createdAt: "2026-03-26T10:00:00.000Z",
        metadata: { controlId: "CC6.1" },
      },
    ]);

    await expect(tool.execute({})).resolves.toEqual([
      {
        orgId: "org_1",
        eventType: "evidence.updated",
        summary: "GitHub evidence synced for CC6.1",
        createdAt: "2026-03-26T10:00:00.000Z",
        metadata: { controlId: "CC6.1" },
      },
      {
        orgId: "org_1",
        eventType: "exception.opened",
        summary: "Missing screenshot evidence for CC8.1",
        createdAt: "2026-03-26T11:00:00.000Z",
        metadata: { controlId: "CC8.1" },
      },
    ]);
  });
});
