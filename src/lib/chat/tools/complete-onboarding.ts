import { tool } from "ai";
import { z } from "zod";
import { updateOrg } from "@/lib/db/queries/organizations";
import { logActivity } from "@/lib/db/queries/activity-log";

export function completeOnboardingToolDef(orgId: string, userId: string) {
  return tool({
    description: "Mark onboarding as complete (internal use)",
    inputSchema: z.object({}),
    execute: async () => {
      const updated = await updateOrg(orgId, { onboarding_completed: true });
      if (!updated) {
        return { error: "Failed to update organization." };
      }

      await logActivity(
        orgId,
        "onboarding.completed",
        "Onboarding marked as complete",
        undefined,
        userId
      );

      return { success: true, message: "Onboarding completed successfully." };
    },
  });
}
