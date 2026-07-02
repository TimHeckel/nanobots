import type { ControlRoomExecutionSource } from "@/lib/chat/control-room-state";
import {
  getExecutionSource,
  upsertExecutionSource,
} from "./queries/execution-sources";

export type ExecutionSourceRow = {
  conversation_id: string;
  browser_capture_phase: string;
  release_verification_phase: string;
  monitoring_phase: string;
  monitoring_control_id: string | null;
  updated_at: string;
};

export type ExecutionSourceAdapter = {
  load(conversationId: string): Promise<ControlRoomExecutionSource | null>;
  save(
    conversationId: string,
    source: ControlRoomExecutionSource,
  ): Promise<void>;
};

function rowToExecutionSource(
  row: ExecutionSourceRow,
): ControlRoomExecutionSource {
  return {
    exceptionExportSource: {
      browserCapturePhase: row.browser_capture_phase as
        | "standby"
        | "queued"
        | "unavailable",
      releaseVerificationPhase: row.release_verification_phase as
        | "at-risk"
        | "capture-queued"
        | "unavailable",
    },
    monitoringExportStatusSource: {
      phase: row.monitoring_phase as
        | "preview"
        | "evidence-refresh-queued"
        | "unavailable",
      controlId: row.monitoring_control_id,
    },
  };
}

function executionSourceToRow(
  conversationId: string,
  source: ControlRoomExecutionSource,
): ExecutionSourceRow {
  return {
    conversation_id: conversationId,
    browser_capture_phase: source.exceptionExportSource.browserCapturePhase,
    release_verification_phase:
      source.exceptionExportSource.releaseVerificationPhase,
    monitoring_phase: source.monitoringExportStatusSource.phase,
    monitoring_control_id: source.monitoringExportStatusSource.controlId,
    updated_at: new Date().toISOString(),
  };
}

export type ExecutionSourceStore = Map<string, ExecutionSourceRow>;

const STORE_KEY = "__nanobotsExecutionSourceStore";

function getExecutionSourceStore(): ExecutionSourceStore {
  const g = globalThis as typeof globalThis & {
    [STORE_KEY]?: ExecutionSourceStore;
  };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = new Map();
  }
  return g[STORE_KEY];
}

export function resetExecutionSourceStore(): void {
  const g = globalThis as typeof globalThis & {
    [STORE_KEY]?: ExecutionSourceStore;
  };
  g[STORE_KEY] = new Map();
}

export function seedExecutionSourceStore(
  entries: Array<{
    conversationId: string;
    source: ControlRoomExecutionSource;
  }>,
): void {
  const store = getExecutionSourceStore();
  for (const entry of entries) {
    store.set(
      entry.conversationId,
      executionSourceToRow(entry.conversationId, entry.source),
    );
  }
}

export function loadExecutionSourceSync(
  conversationId: string,
): ControlRoomExecutionSource | null {
  const store = getExecutionSourceStore();
  const row = store.get(conversationId);
  if (!row) {
    return null;
  }
  return rowToExecutionSource(row);
}

export async function loadExecutionSource(
  conversationId: string,
): Promise<ControlRoomExecutionSource | null> {
  const cached = loadExecutionSourceSync(conversationId);
  if (cached) return cached;

  try {
    const row = await getExecutionSource(conversationId);
    if (!row) return null;

    const store = getExecutionSourceStore();
    store.set(conversationId, row);
    return rowToExecutionSource(row);
  } catch {
    return null;
  }
}

export async function saveExecutionSource(
  conversationId: string,
  source: ControlRoomExecutionSource,
): Promise<void> {
  const row = executionSourceToRow(conversationId, source);
  const store = getExecutionSourceStore();
  store.set(conversationId, row);

  try {
    await upsertExecutionSource(row);
  } catch {
    // Best-effort DB persist; cache already written
  }
}

export function createExecutionSourceAdapter(): ExecutionSourceAdapter {
  return {
    async load(
      conversationId: string,
    ): Promise<ControlRoomExecutionSource | null> {
      return loadExecutionSource(conversationId);
    },

    async save(
      conversationId: string,
      source: ControlRoomExecutionSource,
    ): Promise<void> {
      await saveExecutionSource(conversationId, source);
    },
  };
}