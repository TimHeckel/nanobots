import { z } from "zod";

export function completeOnboardingToolDef(orgId: string, userId: string) {
  return {
    description: "Mark control-room onboarding as complete",
    inputSchema: z.object({}),
    execute: async () => ({
      success: true,
      orgId,
      userId,
      message: "Onboarding completed successfully.",
    }),
  };
}
