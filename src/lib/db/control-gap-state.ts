export type PersistedControlGapState = {
  conversationId: string;
  primaryControlId: string;
  updatedAt: string;
  controls: Array<{
    controlId: string;
    title: string;
    repo: string;
    status: "healthy" | "stale" | "missing" | "blocked";
    exportStatus: "ready" | "action_required" | "blocked";
    exportPhase: "idle" | "syncing";
    missingEvidence: string[];
    nextAction: string;
    exceptionSummary: string[];
    evidenceRecords: Array<{
      evidenceId: string;
      label: string;
      status:
        | "missing"
        | "attached"
        | "manual_review"
        | "queued_scan"
        | "escalated";
      note: string | null;
      updatedAt: string | null;
    }>;
  }>;
};

type ControlGapStore = Map<string, PersistedControlGapState>;

const STORE_KEY = "__nanobotsControlGapStateStore";

function cloneState(
  state: PersistedControlGapState,
): PersistedControlGapState {
  return {
    ...state,
    controls: state.controls.map((control) => ({
      ...control,
      missingEvidence: [...control.missingEvidence],
      exceptionSummary: [...control.exceptionSummary],
      evidenceRecords: control.evidenceRecords.map((record) => ({ ...record })),
    })),
  };
}

function getControlGapStore(): ControlGapStore {
  const g = globalThis as typeof globalThis & {
    [STORE_KEY]?: ControlGapStore;
  };

  if (!g[STORE_KEY]) {
    g[STORE_KEY] = new Map();
  }

  return g[STORE_KEY];
}

export function resetControlGapStateStore(): void {
  const g = globalThis as typeof globalThis & {
    [STORE_KEY]?: ControlGapStore;
  };
  g[STORE_KEY] = new Map();
}

export function seedControlGapState(
  conversationId: string,
  state: PersistedControlGapState,
): void {
  getControlGapStore().set(conversationId, cloneState(state));
}

export async function loadControlGapState(
  conversationId: string,
): Promise<PersistedControlGapState | null> {
  const state = getControlGapStore().get(conversationId);
  return state ? cloneState(state) : null;
}

export async function saveControlGapState(
  conversationId: string,
  state: PersistedControlGapState,
): Promise<void> {
  getControlGapStore().set(conversationId, cloneState(state));
}
