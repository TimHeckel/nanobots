import {
  DEFAULT_CHAT_CONTROL_ROOM_STATE,
  type ChatControlRoomState,
  type ControlRoomExecutionSource,
  type ExceptionExportStatusSource,
  type MonitoringExportStatusSource,
  buildGapResolutionControlRoomState,
  buildUnavailableDerivedControlRoomState,
} from "@/lib/chat/control-room-state";
import {
  QUEUED_CONTROL_ROOM_EXECUTION_SOURCE,
  loadPersistedControlRoomExecutionSource,
  savePersistedControlRoomExecutionSource,
} from "@/lib/chat/control-room-execution-source-seed";
import {
  buildControlRoomStateFromControlGapState,
  type ControlGapState,
} from "@/lib/chat/control-gap-state";
import { deriveSyncPanelState, type SyncPanelState } from "@/lib/chat/evidence-sync-state";
import { loadControlGapState, saveControlGapState } from "@/lib/db/control-gap-state";
import { loadEvidenceSyncState } from "@/lib/db/evidence-sync-state";

type ConversationThreadMessage = {
  id: string;
  role: "operator" | "assistant";
  text: string;
};

const INITIAL_THREAD_MESSAGE: ConversationThreadMessage = {
  id: "msg-gap-summary",
  role: "assistant",
  text: "Missing evidence: incident response walkthrough recording.",
};

const STORE_KEY = "__nanobotsConversationThreadStore";

type ConversationThreadRecord = {
  messages: ConversationThreadMessage[];
  controlRoomState: ChatControlRoomState;
  controlRoomExecutionSource?: ControlRoomExecutionSource;
  controlGapState?: ControlGapState;
  syncPanelState?: SyncPanelState;
};

type ConversationThreadStore = Map<string, ConversationThreadRecord>;

function getConversationThreadStore(): ConversationThreadStore {
  const globalStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: ConversationThreadStore;
  };

  if (!globalStore[STORE_KEY]) {
    globalStore[STORE_KEY] = new Map<string, ConversationThreadRecord>();
  }

  return globalStore[STORE_KEY];
}

function resolveStoredRecordControlRoomState(
  storedRecord?: ConversationThreadRecord,
  options?: {
    allowStoredControlRoomState?: boolean;
  },
): ChatControlRoomState {
  if (storedRecord?.controlGapState) {
    return buildControlRoomStateFromControlGapState(storedRecord.controlGapState);
  }

  if (storedRecord?.controlRoomExecutionSource) {
    return buildGapResolutionControlRoomState(
      storedRecord.controlRoomExecutionSource,
    );
  }

  if (options?.allowStoredControlRoomState && storedRecord?.controlRoomState) {
    return storedRecord.controlRoomState;
  }

  return buildUnavailableDerivedControlRoomState();
}

export function buildConversationThreadMessages(
  conversationId: string,
): ConversationThreadMessage[] {
  const storedMessages =
    getConversationThreadStore().get(conversationId)?.messages ?? [];

  return [INITIAL_THREAD_MESSAGE, ...storedMessages];
}

export async function buildConversationThreadState(
  conversationId: string,
): Promise<{
  messages: ConversationThreadMessage[];
  controlRoomState: ChatControlRoomState;
  syncPanelState?: SyncPanelState;
}> {
  await loadConversationControlGapState(conversationId);
  await loadConversationControlRoomExecutionSource(conversationId);
  await loadConversationSyncPanelState(conversationId);

  const storedRecord = getConversationThreadStore().get(conversationId);

  return {
    messages: buildConversationThreadMessages(conversationId),
    controlRoomState: resolveStoredRecordControlRoomState(storedRecord),
    ...(storedRecord?.syncPanelState
      ? {
          syncPanelState: storedRecord.syncPanelState,
        }
      : {}),
  };
}

export async function loadConversationSyncPanelState(
  conversationId: string,
): Promise<SyncPanelState | null> {
  const store = getConversationThreadStore();
  const storedRecord = store.get(conversationId);

  if (storedRecord?.syncPanelState) {
    return storedRecord.syncPanelState;
  }

  const persisted = await loadEvidenceSyncState(conversationId);
  if (!persisted) {
    return null;
  }

  const syncPanelState = deriveSyncPanelState(persisted);
  store.set(conversationId, {
    messages: buildConversationThreadMessages(conversationId).slice(1),
    controlRoomState: resolveStoredRecordControlRoomState(storedRecord, {
      allowStoredControlRoomState: true,
    }),
    controlRoomExecutionSource: storedRecord?.controlRoomExecutionSource,
    controlGapState: storedRecord?.controlGapState,
    syncPanelState,
  });

  return syncPanelState;
}

export async function loadConversationControlGapState(
  conversationId: string,
): Promise<ControlGapState | null> {
  const store = getConversationThreadStore();
  const storedRecord = store.get(conversationId);

  if (storedRecord?.controlGapState) {
    return storedRecord.controlGapState;
  }

  const persisted = await loadControlGapState(conversationId);
  if (!persisted) {
    return null;
  }

  store.set(conversationId, {
    messages: storedRecord?.messages ?? [],
    controlRoomState: buildControlRoomStateFromControlGapState(persisted),
    controlRoomExecutionSource: storedRecord?.controlRoomExecutionSource,
    controlGapState: persisted,
    syncPanelState: storedRecord?.syncPanelState,
  });

  return persisted;
}

export function loadConversationExceptionExportExecutionSource(
  conversationId: string,
): ExceptionExportStatusSource | null {
  return (
    getConversationThreadStore().get(conversationId)?.controlRoomExecutionSource
      ?.exceptionExportSource ?? null
  );
}

export function loadConversationMonitoringExecutionSource(
  conversationId: string,
): MonitoringExportStatusSource | null {
  return (
    getConversationThreadStore().get(conversationId)?.controlRoomExecutionSource
      ?.monitoringExportStatusSource ?? null
  );
}

export async function loadConversationControlRoomExecutionSource(
  conversationId: string,
): Promise<ControlRoomExecutionSource> {
  const store = getConversationThreadStore();
  const storedRecord = store.get(conversationId);

  // If the thread store already has an execution source, trust it.
  if (storedRecord?.controlRoomExecutionSource) {
    return storedRecord.controlRoomExecutionSource;
  }

  // If a record exists but has no execution source, it was intentionally
  // cleared. Respect the clear -- do not re-hydrate from DB.
  if (storedRecord) {
    return {
      exceptionExportSource: {
        browserCapturePhase: "standby",
        releaseVerificationPhase: "at-risk",
      },
      monitoringExportStatusSource: {
        phase: "preview",
        controlId: null,
      },
    };
  }

  // No record at all -- hydrate from the persisted DB/service seam.
  const persisted = await loadPersistedControlRoomExecutionSource(conversationId);

  if (!persisted) {
    // Cold start with no DB row — store the queued default so that
    // buildConversationThreadState can derive gap-resolution state from it.
    store.set(conversationId, {
      messages: [],
      controlRoomState: DEFAULT_CHAT_CONTROL_ROOM_STATE,
      controlRoomExecutionSource: QUEUED_CONTROL_ROOM_EXECUTION_SOURCE,
    });
    return QUEUED_CONTROL_ROOM_EXECUTION_SOURCE;
  }

  // Persisted row found -- store it as the trusted execution source.
  store.set(conversationId, {
    messages: [],
    controlRoomState: DEFAULT_CHAT_CONTROL_ROOM_STATE,
    controlRoomExecutionSource: persisted,
  });

  return persisted;
}

export function recordConversationControlRoomExecutionSource({
  conversationId,
  controlRoomExecutionSource,
}: {
  conversationId: string;
  controlRoomExecutionSource: ControlRoomExecutionSource;
}) {
  const store = getConversationThreadStore();
  const storedRecord = store.get(conversationId);

  store.set(conversationId, {
    messages: storedRecord?.messages ?? [],
    controlRoomState:
      storedRecord?.controlRoomState ?? DEFAULT_CHAT_CONTROL_ROOM_STATE,
    controlRoomExecutionSource,
    controlGapState: storedRecord?.controlGapState,
    syncPanelState: storedRecord?.syncPanelState,
  });
}

export function clearConversationControlRoomExecutionSource(
  conversationId: string,
) {
  const store = getConversationThreadStore();
  const storedRecord = store.get(conversationId);

  if (!storedRecord) {
    return;
  }

  store.set(conversationId, {
    ...storedRecord,
    controlRoomExecutionSource: undefined,
  });
}

export function recordConversationControlGapState({
  conversationId,
  controlGapState,
  syncPanelState,
}: {
  conversationId: string;
  controlGapState: ControlGapState;
  syncPanelState?: SyncPanelState;
}) {
  const store = getConversationThreadStore();
  const storedRecord = store.get(conversationId);

  store.set(conversationId, {
    messages: storedRecord?.messages ?? [],
    controlRoomState: buildControlRoomStateFromControlGapState(controlGapState),
    controlRoomExecutionSource: storedRecord?.controlRoomExecutionSource,
    controlGapState,
    syncPanelState: syncPanelState ?? storedRecord?.syncPanelState,
  });

  void saveControlGapState(conversationId, controlGapState);
}

export async function recordConversationExceptionExportExecutionSource({
  conversationId,
  exceptionExportSource,
}: {
  conversationId: string;
  exceptionExportSource: ExceptionExportStatusSource;
}) {
  const store = getConversationThreadStore();
  const storedRecord = store.get(conversationId);
  const existingMonitoring =
    storedRecord?.controlRoomExecutionSource?.monitoringExportStatusSource ??
    (await loadPersistedControlRoomExecutionSource(conversationId))?.monitoringExportStatusSource ??
    { phase: "preview" as const, controlId: null };

  store.set(conversationId, {
    messages: storedRecord?.messages ?? [],
    controlRoomState:
      storedRecord?.controlRoomState ?? DEFAULT_CHAT_CONTROL_ROOM_STATE,
    controlRoomExecutionSource: {
      exceptionExportSource,
      monitoringExportStatusSource: existingMonitoring,
    },
    controlGapState: storedRecord?.controlGapState,
    syncPanelState: storedRecord?.syncPanelState,
  });
}

export async function recordConversationMonitoringExecutionSource({
  conversationId,
  monitoringExportStatusSource,
}: {
  conversationId: string;
  monitoringExportStatusSource: MonitoringExportStatusSource;
}) {
  const store = getConversationThreadStore();
  const storedRecord = store.get(conversationId);
  const existingException =
    storedRecord?.controlRoomExecutionSource?.exceptionExportSource ??
    (await loadPersistedControlRoomExecutionSource(conversationId))?.exceptionExportSource ??
    { browserCapturePhase: "standby" as const, releaseVerificationPhase: "at-risk" as const };

  store.set(conversationId, {
    messages: storedRecord?.messages ?? [],
    controlRoomState:
      storedRecord?.controlRoomState ?? DEFAULT_CHAT_CONTROL_ROOM_STATE,
    controlRoomExecutionSource: {
      exceptionExportSource: existingException,
      monitoringExportStatusSource,
    },
    controlGapState: storedRecord?.controlGapState,
    syncPanelState: storedRecord?.syncPanelState,
  });
}

export function recordConversationTurnMessages({
  conversationId,
  operatorText,
  assistantText,
  controlRoomState,
  exceptionExportSource,
  monitoringExportStatusSource,
  controlGapState,
  syncPanelState,
}: {
  conversationId: string;
  operatorText: string;
  assistantText: string;
  controlRoomState: ChatControlRoomState;
  exceptionExportSource: ExceptionExportStatusSource;
  monitoringExportStatusSource: MonitoringExportStatusSource;
  controlGapState?: ControlGapState;
  syncPanelState?: SyncPanelState;
}) {
  const store = getConversationThreadStore();
  const existingRecord = store.get(conversationId);
  const existingMessages = existingRecord?.messages ?? [];
  const nextIndex = existingMessages.length + 1;

  store.set(conversationId, {
    messages: [
      ...existingMessages,
      {
        id: "operator-" + conversationId + "-" + nextIndex,
        role: "operator",
        text: operatorText,
      },
      {
        id: "assistant-" + conversationId + "-" + (nextIndex + 1),
        role: "assistant",
        text: assistantText,
      },
    ],
    controlRoomState,
    controlRoomExecutionSource: {
      exceptionExportSource,
      monitoringExportStatusSource,
    },
    controlGapState,
    syncPanelState: syncPanelState ?? existingRecord?.syncPanelState,
  });

  // Fire-and-forget: persist execution source to DB for durability
  void savePersistedControlRoomExecutionSource(conversationId, {
    exceptionExportSource,
    monitoringExportStatusSource,
  });
  if (controlGapState) {
    void saveControlGapState(conversationId, controlGapState);
  }
}

export function resetConversationThreadMessages() {
  getConversationThreadStore().clear();
}
