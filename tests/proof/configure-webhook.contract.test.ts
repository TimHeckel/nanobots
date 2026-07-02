import { describe, expect, it } from "vitest";
import { configureWebhookToolDef } from "@/lib/chat/tools/configure-webhook";

describe("configure webhook tool contract", () => {
  it("returns the minimal control-room webhook result", async () => {
    const tool = configureWebhookToolDef("org_1", "user_1");
    const describedResult = await tool.execute({
      url: "https://example.com/webhook",
      events: ["evidence.updated", "control.stale"],
      description: "ops",
    });
    const fallbackResult = await tool.execute({
      url: "https://example.com/fallback",
      events: ["control.stale"],
    });

    expect(tool.description).toContain("control-room webhook");
    expect(describedResult).toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      webhook: {
        url: "https://example.com/webhook",
        events: ["evidence.updated", "control.stale"],
        description: "ops",
      },
      message: "Webhook configured for 2 event type(s).",
    });
    expect(fallbackResult).toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      webhook: {
        url: "https://example.com/fallback",
        events: ["control.stale"],
        description: null,
      },
      message: "Webhook configured for 1 event type(s).",
    });
  });
});
