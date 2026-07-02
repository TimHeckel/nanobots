import { describe, expect, it } from "vitest";
import { createBotToolDef } from "@/lib/chat/tools/create-bot";

describe("create bot tool contract", () => {
  it("returns the minimal control-room bot draft result", async () => {
    const tool = createBotToolDef("org_1", "user_1");
    const result = await tool.execute({
      name: "evidence-bot",
      description: "Collects evidence",
      category: "compliance",
      systemPrompt: "Collect evidence",
    });

    expect(tool.description).toContain("control-room bot draft");
    expect(result).toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      bot: {
        name: "evidence-bot",
        description: "Collects evidence",
        category: "compliance",
        status: "draft",
      },
      message: 'Bot "evidence-bot" created as draft.',
    });
  });
});
