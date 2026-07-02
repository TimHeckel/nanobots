import { z } from "zod";

import {
  connectEvidenceSource,
  deriveControlGapStateFromEvidenceSyncState,
  deriveSyncPanelState,
  loadOrCreateEvidenceSyncState,
  saveResolvedEvidenceSyncState,
} from "@/lib/chat/evidence-sync-state";

export function connectEvidenceSourceToolDef(conversationId: string) {
  return {
    description: "Register a durable evidence source connection for operator sync.",
    inputSchema: z.object({
      sourceType: z.literal("github"),
      repo: z.string(),
    }),
    execute: async ({
      sourceType,
      repo,
    }: {
      sourceType: "github";
      repo: string;
    }) => {
      const state = await loadOrCreateEvidenceSyncState(conversationId);
      const nextState = connectEvidenceSource(state, {
        sourceType,
        repo,
      });
      await saveResolvedEvidenceSyncState(nextState);

      return {
        conversationId,
        state: nextState,
        controlGapState: deriveControlGapStateFromEvidenceSyncState(nextState),
        syncPanelState: deriveSyncPanelState(nextState),
        message: `Connected GitHub evidence source ${repo.trim().replace(/^https:\/\/github\.com\//i, "").replace(/\/+$/, "")}.`,
      };
    },
  };
}
