import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/auth/me/route";

describe("auth me route contract", () => {
  it("returns the minimal control-room auth-state payload", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload).toEqual({
      surface: "operator-control-room-auth",
      authenticated: true,
      user: {
        id: "operator-demo",
        name: "Control Room Operator",
        role: "compliance-operator",
      },
    });
  });
});
