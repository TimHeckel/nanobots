import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/auth/github/callback/route";

describe("auth github callback route contract", () => {
  it("returns the minimal control-room auth callback placeholder payload", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload).toEqual({
      surface: "operator-control-room-auth",
      message: "GitHub callback handling is not implemented yet.",
    });
  });
});
