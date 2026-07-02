import { describe, expect, it } from "vitest";
import { listBotsToolDef } from "@/lib/chat/tools/list-bots";

describe("list bots tool contract", () => {
  it("returns the minimal control-room bot inventory", async () => {
    const tool = listBotsToolDef("org_1");

    expect(tool.description).toContain("control-room bot drafts");

    await expect(tool.execute({})).resolves.toEqual([
      {
        orgId: "org_1",
        name: "evidence-bot",
        enabled: true,
        description: "Collects evidence gaps for Sprinto controls.",
      },
      {
        orgId: "org_1",
        name: "policy-bot",
        enabled: false,
        description: "Tracks policy changes for control updates.",
      },
    ]);
  });
});
