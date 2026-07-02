import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createExecutionSourceAdapter,
  resetExecutionSourceStore,
  seedExecutionSourceStore,
} from "@/lib/db/execution-source";
import {
  DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
  DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
  type ControlRoomExecutionSource,
} from "@/lib/chat/control-room-state";
import {
  QUEUED_CONTROL_ROOM_EXECUTION_SOURCE,
  savePersistedControlRoomExecutionSource,
  loadPersistedControlRoomExecutionSource,
} from "@/lib/chat/control-room-execution-source-seed";
import {
  loadConversationControlRoomExecutionSource,
  loadConversationExceptionExportExecutionSource,
  loadConversationMonitoringExecutionSource,
  clearConversationControlRoomExecutionSource,
  recordConversationControlRoomExecutionSource,
  recordConversationExceptionExportExecutionSource,
  recordConversationMonitoringExecutionSource,
  resetConversationThreadMessages,
} from "@/lib/chat/conversation-thread-store";

const PERSISTED_STANDBY_SOURCE: ControlRoomExecutionSource = {
  exceptionExportSource: DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
  monitoringExportStatusSource: DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
};

const PERSISTED_QUEUED_SOURCE: ControlRoomExecutionSource = {
  exceptionExportSource: {
    browserCapturePhase: "queued",
    releaseVerificationPhase: "capture-queued",
  },
  monitoringExportStatusSource: {
    phase: "evidence-refresh-queued",
    controlId: "CC7.2",
  },
};

describe("persisted execution-source contract", () => {
  beforeEach(() => {
    vi.resetModules();
    resetExecutionSourceStore();
    resetConversationThreadMessages();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetExecutionSourceStore();
    resetConversationThreadMessages();
  });

  describe("adapter layer", () => {
    it("returns persisted execution source when a row exists for the conversation", async () => {
      seedExecutionSourceStore([
        { conversationId: "conv-persisted-1", source: PERSISTED_STANDBY_SOURCE },
      ]);

      const adapter = createExecutionSourceAdapter();
      const result = await adapter.load("conv-persisted-1");

      expect(result).toEqual(PERSISTED_STANDBY_SOURCE);
      expect(result).not.toEqual(QUEUED_CONTROL_ROOM_EXECUTION_SOURCE);
    });

    it("returns null for a missing conversation row instead of synthetic queued values", async () => {
      const adapter = createExecutionSourceAdapter();
      const result = await adapter.load("conv-does-not-exist");

      expect(result).toBeNull();
    });

    it("round-trips a save then load with identical execution source", async () => {
      const adapter = createExecutionSourceAdapter();
      await adapter.save("conv-roundtrip", PERSISTED_QUEUED_SOURCE);
      const loaded = await adapter.load("conv-roundtrip");

      expect(loaded).toEqual(PERSISTED_QUEUED_SOURCE);
    });
  });

  describe("loadPersistedControlRoomExecutionSource contract", () => {
    it("returns persisted source for conversation instead of the hardcoded queued seed", async () => {
      seedExecutionSourceStore([
        { conversationId: "conv-auth-1", source: PERSISTED_STANDBY_SOURCE },
      ]);

      const result = await loadPersistedControlRoomExecutionSource("conv-auth-1");

      expect(result).toEqual(PERSISTED_STANDBY_SOURCE);
      expect(result).not.toEqual(QUEUED_CONTROL_ROOM_EXECUTION_SOURCE);
    });

    it("returns null for a missing row so the caller can preserve last trusted state", async () => {
      const result = await loadPersistedControlRoomExecutionSource("conv-missing");

      expect(result).toBeNull();
    });
  });

  describe("savePersistedControlRoomExecutionSource contract", () => {
    it("persists an execution source that is loadable by the read path", async () => {
      await savePersistedControlRoomExecutionSource("conv-save-roundtrip", PERSISTED_STANDBY_SOURCE);

      const loaded = await loadPersistedControlRoomExecutionSource("conv-save-roundtrip");
      expect(loaded).toEqual(PERSISTED_STANDBY_SOURCE);
    });

    it("overwrites a previously saved execution source", async () => {
      await savePersistedControlRoomExecutionSource("conv-save-overwrite", PERSISTED_STANDBY_SOURCE);
      await savePersistedControlRoomExecutionSource("conv-save-overwrite", PERSISTED_QUEUED_SOURCE);

      const loaded = await loadPersistedControlRoomExecutionSource("conv-save-overwrite");
      expect(loaded).toEqual(PERSISTED_QUEUED_SOURCE);
      expect(loaded).not.toEqual(PERSISTED_STANDBY_SOURCE);
    });
  });

  describe("conversation-thread-store persisted reload contract", () => {
    it("loadConversationControlRoomExecutionSource uses persisted state as authoritative on reload", async () => {
      seedExecutionSourceStore([
        { conversationId: "conv-reload-1", source: PERSISTED_STANDBY_SOURCE },
      ]);

      const result = await loadConversationControlRoomExecutionSource("conv-reload-1");

      expect(result).toEqual(PERSISTED_STANDBY_SOURCE);
      expect(result).not.toEqual(QUEUED_CONTROL_ROOM_EXECUTION_SOURCE);
    });

    it("preserves last trusted persisted panel state when the row is missing instead of reseeding queued values", async () => {
      seedExecutionSourceStore([
        { conversationId: "conv-trusted-state", source: PERSISTED_STANDBY_SOURCE },
      ]);


      const firstLoad = await loadConversationControlRoomExecutionSource("conv-trusted-state");
      expect(firstLoad).toEqual(PERSISTED_STANDBY_SOURCE);

      resetExecutionSourceStore();

      const secondLoad = await loadConversationControlRoomExecutionSource("conv-trusted-state");
      expect(secondLoad).toEqual(PERSISTED_STANDBY_SOURCE);
      expect(secondLoad).not.toEqual(QUEUED_CONTROL_ROOM_EXECUTION_SOURCE);
    });

    it("preserves last trusted persisted panel state on read failure instead of reseeding queued values", async () => {
      seedExecutionSourceStore([
        { conversationId: "conv-fail-safe", source: PERSISTED_QUEUED_SOURCE },
      ]);


      const trusted = await loadConversationControlRoomExecutionSource("conv-fail-safe");
      expect(trusted).toEqual(PERSISTED_QUEUED_SOURCE);

      resetExecutionSourceStore();

      const afterFailure = await loadConversationControlRoomExecutionSource("conv-fail-safe");
      expect(afterFailure).toEqual(PERSISTED_QUEUED_SOURCE);
      expect(afterFailure).not.toEqual(QUEUED_CONTROL_ROOM_EXECUTION_SOURCE);
    });
  });

  describe("conversation-thread-store exception/monitoring load helpers", () => {
    it("loadConversationExceptionExportExecutionSource returns null when no record exists", () => {
      const result = loadConversationExceptionExportExecutionSource("conv-no-record");
      expect(result).toBeNull();
    });

    it("loadConversationExceptionExportExecutionSource returns the exception source from a stored record", () => {
      recordConversationControlRoomExecutionSource({
        conversationId: "conv-with-exception",
        controlRoomExecutionSource: PERSISTED_STANDBY_SOURCE,
      });

      const result = loadConversationExceptionExportExecutionSource("conv-with-exception");
      expect(result).toEqual(DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE);
    });

    it("loadConversationMonitoringExecutionSource returns null when no record exists", () => {
      const result = loadConversationMonitoringExecutionSource("conv-no-record");
      expect(result).toBeNull();
    });

    it("loadConversationMonitoringExecutionSource returns the monitoring source from a stored record", () => {
      recordConversationControlRoomExecutionSource({
        conversationId: "conv-with-monitoring",
        controlRoomExecutionSource: PERSISTED_STANDBY_SOURCE,
      });

      const result = loadConversationMonitoringExecutionSource("conv-with-monitoring");
      expect(result).toEqual(DEFAULT_MONITORING_EXPORT_STATUS_SOURCE);
    });
  });

  describe("clearConversationControlRoomExecutionSource", () => {
    it("early-returns without error when no record exists for the conversation", () => {
      expect(() => clearConversationControlRoomExecutionSource("conv-nonexistent")).not.toThrow();
    });

    it("clears the execution source from an existing record", () => {
      recordConversationControlRoomExecutionSource({
        conversationId: "conv-clear-test",
        controlRoomExecutionSource: PERSISTED_STANDBY_SOURCE,
      });

      clearConversationControlRoomExecutionSource("conv-clear-test");

      const result = loadConversationExceptionExportExecutionSource("conv-clear-test");
      expect(result).toBeNull();
    });
  });

  describe("partial-update merge branches with persisted fallback", () => {
    it("recordConversationExceptionExportExecutionSource merges monitoring from persisted store when thread store is empty", async () => {
      seedExecutionSourceStore([
        { conversationId: "conv-exception-merge", source: PERSISTED_QUEUED_SOURCE },
      ]);

      await recordConversationExceptionExportExecutionSource({
        conversationId: "conv-exception-merge",
        exceptionExportSource: DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
      });

      const monitoring = loadConversationMonitoringExecutionSource("conv-exception-merge");
      expect(monitoring).toEqual(PERSISTED_QUEUED_SOURCE.monitoringExportStatusSource);

      const exception = loadConversationExceptionExportExecutionSource("conv-exception-merge");
      expect(exception).toEqual(DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE);
    });

    it("recordConversationExceptionExportExecutionSource falls back to default when neither thread nor persisted store has monitoring", async () => {
      await recordConversationExceptionExportExecutionSource({
        conversationId: "conv-exception-no-persisted",
        exceptionExportSource: DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
      });

      const monitoring = loadConversationMonitoringExecutionSource("conv-exception-no-persisted");
      expect(monitoring).toEqual({ phase: "preview", controlId: null });
    });

    it("recordConversationMonitoringExecutionSource merges exception from persisted store when thread store is empty", async () => {
      seedExecutionSourceStore([
        { conversationId: "conv-monitoring-merge", source: PERSISTED_QUEUED_SOURCE },
      ]);

      await recordConversationMonitoringExecutionSource({
        conversationId: "conv-monitoring-merge",
        monitoringExportStatusSource: DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
      });

      const exception = loadConversationExceptionExportExecutionSource("conv-monitoring-merge");
      expect(exception).toEqual(PERSISTED_QUEUED_SOURCE.exceptionExportSource);

      const monitoring = loadConversationMonitoringExecutionSource("conv-monitoring-merge");
      expect(monitoring).toEqual(DEFAULT_MONITORING_EXPORT_STATUS_SOURCE);
    });

    it("recordConversationMonitoringExecutionSource falls back to default when neither thread nor persisted store has exception", async () => {
      await recordConversationMonitoringExecutionSource({
        conversationId: "conv-monitoring-no-persisted",
        monitoringExportStatusSource: DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
      });

      const exception = loadConversationExceptionExportExecutionSource("conv-monitoring-no-persisted");
      expect(exception).toEqual({ browserCapturePhase: "standby", releaseVerificationPhase: "at-risk" });
    });
  });

  describe("/api/conversations/[id]/messages persisted reload", () => {
    it("returns persisted control room state derived from stored execution source on /chat/[id] reload", async () => {
      seedExecutionSourceStore([
        { conversationId: "conv-route-reload", source: PERSISTED_STANDBY_SOURCE },
      ]);

      const { GET } = await import(
        "@/app/api/conversations/[id]/messages/route"
      );

      const response = await GET(
        new Request("http://localhost/api/conversations/conv-route-reload/messages"),
        { params: Promise.resolve({ id: "conv-route-reload" }) },
      );
      const payload = await response.json();

      expect(payload.controlRoomState).toBeDefined();
      expect(payload.controlRoomState.monitoringExportStatus.phase).toBe("preview");
      expect(payload.controlRoomState.monitoringExportStatus.controlId).toBeNull();
      expect(payload.controlRoomState.browserCapture.status).not.toBe("Queued");
    });

    it("preserves last trusted state on messages route when persisted row disappears", async () => {
      seedExecutionSourceStore([
        { conversationId: "conv-route-missing", source: PERSISTED_STANDBY_SOURCE },
      ]);


      await loadConversationControlRoomExecutionSource("conv-route-missing");

      resetExecutionSourceStore();

      const result = loadConversationExceptionExportExecutionSource("conv-route-missing");
      expect(result).toEqual(DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE);
    });
  });
});