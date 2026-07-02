import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/admin/prompts/route";

describe("admin prompts route contract", () => {
  it("returns the minimal control-room admin placeholder payload", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload).toEqual({
      prompts: [],
      surface: "operator-control-room-admin",
      message: "Prompt administration is not implemented yet.",
    });
  });
});
