import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/events/route";

describe("events route contract", () => {
  it("returns the minimal control-room events payload", async () => {
    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload).toEqual({
      surface: "operator-control-room-events",
      accepted: true,
      eventType: "evidence-refresh-requested",
    });
  });
});
