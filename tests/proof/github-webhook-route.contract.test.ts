import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/github/route";

describe("github webhook route contract", () => {
  it("returns the minimal control-room github webhook payload", async () => {
    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload).toEqual({
      surface: "operator-control-room-github-webhook",
      accepted: true,
      eventType: "github-evidence-sync",
    });
  });
});
