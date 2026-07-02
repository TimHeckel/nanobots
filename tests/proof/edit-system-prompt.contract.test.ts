import { describe, expect, it } from "vitest";
import { editSystemPromptToolDef } from "@/lib/chat/tools/edit-system-prompt";

describe("edit system prompt tool contract", () => {
  it("returns minimal control-room prompt view and update states", async () => {
    const adminTool = editSystemPromptToolDef("org_1", "user_1", "admin");
    const memberTool = editSystemPromptToolDef("org_1", "user_2", "member");

    expect(adminTool.description).toContain("control-room prompt draft");

    await expect(
      adminTool.execute({ agentName: "evidence-bot" })
    ).resolves.toEqual({
      orgId: "org_1",
      agentName: "evidence-bot",
      promptText: "Prompt preview for evidence-bot.",
      mode: "view",
      isEditable: true,
    });

    await expect(
      memberTool.execute({
        agentName: "evidence-bot",
        newPrompt: "Capture SOC 2 evidence daily.",
      })
    ).resolves.toEqual({
      success: false,
      orgId: "org_1",
      userId: "user_2",
      agentName: "evidence-bot",
      error: "Only admins can update control-room prompts.",
    });

    await expect(
      adminTool.execute({
        agentName: "evidence-bot",
        newPrompt: "Capture SOC 2 evidence daily.",
      })
    ).resolves.toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      agentName: "evidence-bot",
      promptText: "Capture SOC 2 evidence daily.",
      message: 'Prompt for "evidence-bot" updated.',
    });
  });
});
