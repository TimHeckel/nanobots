import { describe, expect, it } from "vitest";
import { listWebhooksToolDef } from "@/lib/chat/tools/list-webhooks";

describe("list webhooks tool contract", () => {
  it("returns the minimal control-room webhook states", async () => {
    const emptyTool = listWebhooksToolDef("org_empty");
    const populatedTool = listWebhooksToolDef("org_1");

    expect(populatedTool.description).toContain("control-room webhook endpoints");

    await expect(emptyTool.execute({})).resolves.toEqual({
      webhooks: [],
      message: "No control-room webhooks configured yet.",
    });

    await expect(populatedTool.execute({})).resolves.toEqual({
      webhooks: [
        {
          id: "wh_1",
          url: "https://example.com/control-room/webhooks/github",
          events: ["evidence.updated", "control.exception"],
          active: true,
          description: "Primary Sprinto middleware webhook",
        },
      ],
    });
  });
});
