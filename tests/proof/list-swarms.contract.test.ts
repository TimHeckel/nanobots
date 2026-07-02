import { describe, expect, it } from "vitest";
import { listSwarmsToolDef } from "@/lib/chat/tools/list-swarms";

describe("list swarms tool contract", () => {
  it("returns the minimal control-room swarm states", async () => {
    const emptyTool = listSwarmsToolDef("org_empty");
    const populatedTool = listSwarmsToolDef("org_1");

    expect(populatedTool.description).toContain("control-room swarms");

    await expect(emptyTool.execute({})).resolves.toEqual({
      swarms: [],
      message: "No control-room swarms configured yet.",
    });

    await expect(populatedTool.execute({})).resolves.toEqual({
      swarms: [
        {
          name: "access-review-swarm",
          description: "Collects quarterly access review evidence.",
          botCount: 2,
          bots: ["evidence-bot", "policy-bot"],
        },
      ],
    });
  });
});
