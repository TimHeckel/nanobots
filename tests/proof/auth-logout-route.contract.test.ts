import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/logout/route";

describe("auth logout route contract", () => {
  it("returns the minimal control-room logout placeholder payload", async () => {
    const response = await POST();
    const payload = await response.json();

    expect(payload).toEqual({
      surface: "operator-control-room-auth",
      message: "Logout flow is not implemented yet.",
    });
  });
});
