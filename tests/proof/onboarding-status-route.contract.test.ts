import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/onboarding/status/route";

describe("onboarding status route contract", () => {
  it("returns the minimal control-room onboarding status payload", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload).toEqual({
      surface: "operator-control-room-onboarding",
      onboardingStatus: "ready",
      nextStep: "Connect GitHub",
    });
  });
});
