import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/admin/prompts/[agentName]/route";

describe("admin per-agent route contract", () => {
  it("returns the minimal control-room admin placeholder for one agent", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ agentName: "chat" }),
    });
    const payload = await response.json();

    expect(payload).toEqual({
      agentName: "chat",
      surface: "operator-control-room-admin",
      message: "Per-agent prompt administration is not implemented yet.",
    });
  });
});
