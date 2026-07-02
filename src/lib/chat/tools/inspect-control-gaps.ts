import { z } from "zod";

import {
  inspectControlGaps,
  loadOrCreateControlGapState,
} from "@/lib/chat/control-gap-state";

export function inspectControlGapsToolDef(conversationId: string) {
  return {
    description: "Inspect tracked controls and return actionable evidence gaps.",
    inputSchema: z.object({
      includeHealthy: z.boolean().optional().default(false),
    }),
    execute: async ({
      includeHealthy = false,
    }: {
      includeHealthy?: boolean;
    }) => {
      const state = await loadOrCreateControlGapState(conversationId);
      const result = inspectControlGaps(state);

      return {
        conversationId,
        state,
        primaryControlId: result.primaryControlId,
        gaps: includeHealthy
          ? state.controls.map((control) => ({
              controlId: control.controlId,
              status: control.status,
              exportStatus: control.exportStatus,
              missingEvidence: [...control.missingEvidence],
              nextAction: control.nextAction,
            }))
          : result.summaries,
        controlRoomState: result.controlRoomState,
        executionSource: result.executionSource,
        message:
          result.summaries.length > 0
            ? `Found ${result.summaries.length} actionable control gap(s).`
            : "All tracked controls are currently healthy.",
      };
    },
  };
}
