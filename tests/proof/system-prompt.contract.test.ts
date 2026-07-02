import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";

describe("system prompt contract", () => {
  it("builds the minimal control-room system prompt", async () => {
    const prompt = await buildSystemPrompt(
      {
        id: "org_1",
        name: "Acme",
      } as never,
      {
        repos: [],
        botConfigs: [],
        pendingProposalCount: 0,
        swarms: [],
        webhookCount: 0,
        recentActivity: [],
      } as never,
    );

    expect(prompt).toBe("Operator Control Room for Acme");
  });
});
