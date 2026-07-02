import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/auth/github/route";

describe("auth github route contract", () => {
  it("returns the minimal control-room auth placeholder payload", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload).toEqual({
      surface: "operator-control-room-auth",
      message: "GitHub connection flow is not implemented yet.",
    });
  });
});
