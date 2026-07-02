import { z } from "zod";

import {
  deriveSyncPanelState,
  loadOrCreateEvidenceSyncState,
  persistDerivedControlGapStateFromEvidenceSync,
  saveResolvedEvidenceSyncState,
  syncEvidenceSource,
} from "@/lib/chat/evidence-sync-state";

export function syncEvidenceSourceToolDef(conversationId: string) {
  return {
    description:
      "Collect normalized evidence from a connected source and map it to Sprinto controls.",
    inputSchema: z.object({
      sourceId: z.string(),
    }),
    execute: async ({
      sourceId,
    }: {
      sourceId: string;
    }) => {
      const state = await loadOrCreateEvidenceSyncState(conversationId);
      if (!state.sources.some((source) => source.sourceId === sourceId)) {
        return {
          conversationId,
          state,
          controlGapState:
            await persistDerivedControlGapStateFromEvidenceSync(state),
          syncPanelState: deriveSyncPanelState(state),
          message: `No connected evidence source found for ${sourceId}. Connect it before syncing.`,
        };
      }

      const nextState = syncEvidenceSource(state, { sourceId });
      await saveResolvedEvidenceSyncState(nextState);
      const controlGapState =
        await persistDerivedControlGapStateFromEvidenceSync(nextState);

      return {
        conversationId,
        state: nextState,
        controlGapState,
        syncPanelState: deriveSyncPanelState(nextState),
        message: `Synced evidence from ${sourceId} and refreshed control mappings.`,
      };
    },
  };
}
