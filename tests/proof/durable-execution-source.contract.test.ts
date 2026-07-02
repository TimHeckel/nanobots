import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
  DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
  type ControlRoomExecutionSource,
} from "@/lib/chat/control-room-state";

// Mock the DB query layer with a durable in-process store.
// This survives globalThis cache clears, simulating real DB durability.
const durableDbStore = new Map<string, unknown>();

vi.mock("@/lib/db/queries/execution-sources", () => ({
  getExecutionSource: vi.fn(async (conversationId: string) => {
    return durableDbStore.get(conversationId) ?? null;
  }),
  upsertExecutionSource: vi.fn(async (row: unknown) => {
    durableDbStore.set((row as any).conversation_id, row);
  }),
}));

const PERSISTED_SOURCE: ControlRoomExecutionSource = {
  exceptionExportSource: {
    browserCapturePhase: "queued",
    releaseVerificationPhase: "capture-queued",
  },
  monitoringExportStatusSource: {
    phase: "evidence-refresh-queued",
    controlId: "CC8.1",
  },
};

const STANDBY_SOURCE: ControlRoomExecutionSource = {
  exceptionExportSource: DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
  monitoringExportStatusSource: DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
};

function clearProcessCaches() {
  delete (globalThis as any).__nanobotsExecutionSourceStore;
  delete (globalThis as any).__nanobotsConversationThreadStore;
}

describe("durable execution-source contract", () => {
  beforeEach(() => {
    durableDbStore.clear();
    clearProcessCaches();
  });

  afterEach(() => {
    durableDbStore.clear();
    clearProcessCaches();
  });

  describe("execution source survives process cache clear", () => {
    it("save then cache-clear then load returns the persisted source", async () => {
      const {
        savePersistedControlRoomExecutionSource,
        loadPersistedControlRoomExecutionSource,
      } = await import("@/lib/chat/control-room-execution-source-seed");

      await savePersistedControlRoomExecutionSource("conv-durable-1", PERSISTED_SOURCE);

      clearProcessCaches();

      const loaded = await loadPersistedControlRoomExecutionSource("conv-durable-1");
      expect(loaded).toEqual(PERSISTED_SOURCE);
    });

    it("overwritten source survives cache clear with latest value", async () => {
      const {
        savePersistedControlRoomExecutionSource,
        loadPersistedControlRoomExecutionSource,
      } = await import("@/lib/chat/control-room-execution-source-seed");

      await savePersistedControlRoomExecutionSource("conv-durable-2", STANDBY_SOURCE);
      await savePersistedControlRoomExecutionSource("conv-durable-2", PERSISTED_SOURCE);

      clearProcessCaches();

      const loaded = await loadPersistedControlRoomExecutionSource("conv-durable-2");
      expect(loaded).toEqual(PERSISTED_SOURCE);
      expect(loaded).not.toEqual(STANDBY_SOURCE);
    });

    it("returns null for conversation never saved even after cache clear", async () => {
      const {
        loadPersistedControlRoomExecutionSource,
      } = await import("@/lib/chat/control-room-execution-source-seed");

      clearProcessCaches();

      const loaded = await loadPersistedControlRoomExecutionSource("conv-never-saved");
      expect(loaded).toBeNull();
    });
  });

  describe("/chat/[id] reload returns persisted state after process restart", () => {
    it("messages route returns persisted execution-derived state after cache clear", async () => {
      const {
        savePersistedControlRoomExecutionSource,
      } = await import("@/lib/chat/control-room-execution-source-seed");

      await savePersistedControlRoomExecutionSource("conv-route-durable", PERSISTED_SOURCE);

      clearProcessCaches();

      const { GET } = await import(
        "@/app/api/conversations/[id]/messages/route"
      );

      const response = await GET(
        new Request("http://localhost/api/conversations/conv-route-durable/messages"),
        { params: Promise.resolve({ id: "conv-route-durable" }) },
      );
      const payload = await response.json();

      expect(payload.controlRoomState).toBeDefined();
      expect(payload.controlRoomState.monitoringExportStatus.phase).toBe("evidence-refresh-queued");
      expect(payload.controlRoomState.monitoringExportStatus.controlId).toBe("CC8.1");
    });

    it("loadConversationControlRoomExecutionSource returns persisted state after cache clear", async () => {
      const {
        savePersistedControlRoomExecutionSource,
      } = await import("@/lib/chat/control-room-execution-source-seed");
      const {
        loadConversationControlRoomExecutionSource,
      } = await import("@/lib/chat/conversation-thread-store");

      await savePersistedControlRoomExecutionSource("conv-hydrate", PERSISTED_SOURCE);

      clearProcessCaches();

      const loaded = await loadConversationControlRoomExecutionSource("conv-hydrate");
      expect(loaded).toEqual(PERSISTED_SOURCE);
    });
  });
});