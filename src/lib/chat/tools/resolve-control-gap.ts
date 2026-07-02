import { z } from "zod";

import {
  loadOrCreateControlGapState,
  resolveControlGap,
  saveResolvedControlGapState,
} from "@/lib/chat/control-gap-state";

export function resolveControlGapToolDef(conversationId: string) {
  return {
    description: "Resolve, refresh, or escalate a tracked control gap.",
    inputSchema: z.object({
      controlId: z.string(),
      action: z.enum([
        "attach_evidence",
        "manual_review",
        "trigger_rescan",
        "escalate",
      ]),
      evidenceId: z.string().optional(),
      note: z.string().optional(),
    }),
    execute: async ({
      controlId,
      action,
      evidenceId,
      note,
    }: {
      controlId: string;
      action:
        | "attach_evidence"
        | "manual_review"
        | "trigger_rescan"
        | "escalate";
      evidenceId?: string;
      note?: string;
    }) => {
      const state = await loadOrCreateControlGapState(conversationId);
      const result = resolveControlGap(state, {
        controlId,
        action,
        evidenceId,
        note,
      });

      if (result.success) {
        await saveResolvedControlGapState(result.state);
      }

      return {
        conversationId,
        success: result.success,
        message: result.message,
        controlRoomState: result.controlRoomState,
        executionSource: result.executionSource,
        mutatedControl: result.mutatedControl,
        state: result.state,
      };
    },
  };
}
