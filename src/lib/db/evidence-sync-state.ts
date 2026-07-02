export type PersistedEvidenceSyncState = {
  conversationId: string;
  updatedAt: string;
  sources: Array<{
    sourceId: string;
    sourceType: "github";
    repo: string;
    connectedAt: string;
    lastSyncedAt: string | null;
    status: "connected" | "synced";
  }>;
  evidenceRecords: Array<{
    evidenceId: string;
    sourceId: string;
    kind:
      | "commit"
      | "pr_review"
      | "ci_result"
      | "branch_protection"
      | "repository_note";
    label: string;
    capturedAt: string;
    mappedControlId: string | null;
    exportStatus: "ready" | "action_required";
    note: string | null;
  }>;
};

type EvidenceSyncStore = Map<string, PersistedEvidenceSyncState>;

const STORE_KEY = "__nanobotsEvidenceSyncStateStore";

function cloneState(
  state: PersistedEvidenceSyncState,
): PersistedEvidenceSyncState {
  return {
    ...state,
    sources: state.sources.map((source) => ({ ...source })),
    evidenceRecords: state.evidenceRecords.map((record) => ({ ...record })),
  };
}

function getEvidenceSyncStore(): EvidenceSyncStore {
  const g = globalThis as typeof globalThis & {
    [STORE_KEY]?: EvidenceSyncStore;
  };

  if (!g[STORE_KEY]) {
    g[STORE_KEY] = new Map();
  }

  return g[STORE_KEY];
}

export function resetEvidenceSyncStateStore(): void {
  const g = globalThis as typeof globalThis & {
    [STORE_KEY]?: EvidenceSyncStore;
  };
  g[STORE_KEY] = new Map();
}

export function seedEvidenceSyncState(
  conversationId: string,
  state: PersistedEvidenceSyncState,
): void {
  getEvidenceSyncStore().set(conversationId, cloneState(state));
}

export async function loadEvidenceSyncState(
  conversationId: string,
): Promise<PersistedEvidenceSyncState | null> {
  const state = getEvidenceSyncStore().get(conversationId);
  return state ? cloneState(state) : null;
}

export async function saveEvidenceSyncState(
  conversationId: string,
  state: PersistedEvidenceSyncState,
): Promise<void> {
  getEvidenceSyncStore().set(conversationId, cloneState(state));
}
