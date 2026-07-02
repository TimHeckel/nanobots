import { describe, expect, it } from "vitest";
import { completeOnboardingToolDef } from "@/lib/chat/tools/complete-onboarding";

describe("complete onboarding tool contract", () => {
  it("returns the minimal control-room onboarding result", async () => {
    const tool = completeOnboardingToolDef("org_1", "user_1");
    const result = await tool.execute({});

    expect(tool.description).toContain("control-room onboarding");
    expect(result).toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      message: "Onboarding completed successfully.",
    });
  });
});
