import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ControlRoomExecutionSource } from "@/lib/chat/control-room-state";

let dbReadError: Error | null = null;
let dbWriteError: Error | null = null;
const durableDbStore = new Map<string, unknown>();

vi.mock("@/lib/db/queries/execution-sources", () => ({
  getExecutionSource: vi.fn(async (conversationId: string) => {
    if (dbReadError) throw dbReadError;
    return durableDbStore.get(conversationId) ?? null;
  }),
  upsertExecutionSource: vi.fn(async (row: unknown) => {
    if (dbWriteError) throw dbWriteError;
    durableDbStore.set((row as any).conversation_id, row);
  }),
}));

const CACHED_SOURCE: ControlRoomExecutionSource = {
  exceptionExportSource: {
    browserCapturePhase: "queued",
    releaseVerificationPhase: "capture-queued",
  },
  monitoringExportStatusSource: {
    phase: "evidence-refresh-queued",
    controlId: "CC8.1",
  },
};

const UPDATED_SOURCE: ControlRoomExecutionSource = {
  exceptionExportSource: {
    browserCapturePhase: "unavailable",
    releaseVerificationPhase: "unavailable",
  },
  monitoringExportStatusSource: {
    phase: "unavailable",
    controlId: null,
  },
};

function clearProcessCaches() {
  delete (globalThis as any).__nanobotsExecutionSourceStore;
  delete (globalThis as any).__nanobotsConversationThreadStore;
}

describe("db failure-mode contract", () => {
  beforeEach(() => {
    durableDbStore.clear();
    clearProcessCaches();
    dbReadError = null;
    dbWriteError = null;
  });

  afterEach(() => {
    durableDbStore.clear();
    clearProcessCaches();
    dbReadError = null;
    dbWriteError = null;
  });

  describe("DB read error preserves last trusted cached state", () => {
    it("returns null when DB read throws and cache is cold", async () => {
      const { saveExecutionSource, loadExecutionSource } = await import("@/lib/db/execution-source");
      await saveExecutionSource("conv-read-fail", CACHED_SOURCE);
      delete (globalThis as any).__nanobotsExecutionSourceStore;
      dbReadError = new Error("connection refused");
      const loaded = await loadExecutionSource("conv-read-fail");
      expect(loaded).toBeNull();
    });

    it("preserves cached state on reload when DB is down", async () => {
      const { seedExecutionSourceStore, loadExecutionSource } = await import("@/lib/db/execution-source");
      seedExecutionSourceStore([{ conversationId: "conv-cached-ok", source: CACHED_SOURCE }]);
      dbReadError = new Error("connection refused");
      const loaded = await loadExecutionSource("conv-cached-ok");
      expect(loaded).toEqual(CACHED_SOURCE);
    });

    it("messages route returns cached state when DB read fails on reload", async () => {
      const { recordConversationTurnMessages } = await import("@/lib/chat/conversation-thread-store");
      recordConversationTurnMessages({
        conversationId: "conv-route-read-fail",
        operatorText: "test",
        assistantText: "response",
        controlRoomState: {
          nextRecommendedAction: "next",
          missingEvidence: "missing",
          browserCapture: { status: "Standby", detail: "detail" },
          monitoringExportStatus: { phase: "evidence-refresh-queued", controlId: "CC8.1" },
          cc81ControlMapping: { note: "note" },
          exceptionSummary: { items: ["item"] },
          releaseVerification: { status: "At risk", freshness: "freshness" },
        },
        exceptionExportSource: CACHED_SOURCE.exceptionExportSource,
        monitoringExportStatusSource: CACHED_SOURCE.monitoringExportStatusSource,
      });
      dbReadError = new Error("connection refused");
      const { GET } = await import("@/app/api/conversations/[id]/messages/route");
      const response = await GET(
        new Request("http://localhost/api/conversations/conv-route-read-fail/messages"),
        { params: Promise.resolve({ id: "conv-route-read-fail" }) },
      );
      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload.controlRoomState.monitoringExportStatus.phase).toBe("evidence-refresh-queued");
      expect(payload.controlRoomState.monitoringExportStatus.controlId).toBe("CC8.1");
    });
  });

  describe("DB write error does not break chat-side write path", () => {
    it("saveExecutionSource succeeds in cache even when DB write throws", async () => {
      const { saveExecutionSource, loadExecutionSourceSync } = await import("@/lib/db/execution-source");
      dbWriteError = new Error("disk full");
      await expect(saveExecutionSource("conv-write-fail", CACHED_SOURCE)).resolves.toBeUndefined();
      const cached = loadExecutionSourceSync("conv-write-fail");
      expect(cached).toEqual(CACHED_SOURCE);
    });

    it("DB write error does not clobber the trusted cached snapshot", async () => {
      const { saveExecutionSource, loadExecutionSourceSync } = await import("@/lib/db/execution-source");
      await saveExecutionSource("conv-no-clobber", CACHED_SOURCE);
      expect(loadExecutionSourceSync("conv-no-clobber")).toEqual(CACHED_SOURCE);
      dbWriteError = new Error("disk full");
      await saveExecutionSource("conv-no-clobber", UPDATED_SOURCE);
      const cached = loadExecutionSourceSync("conv-no-clobber");
      expect(cached).toEqual(UPDATED_SOURCE);
      expect(cached).not.toEqual(CACHED_SOURCE);
    });

    it("recordConversationTurnMessages does not throw when DB write fails", async () => {
      const { recordConversationTurnMessages, loadConversationExceptionExportExecutionSource, loadConversationMonitoringExecutionSource } = await import("@/lib/chat/conversation-thread-store");
      dbWriteError = new Error("disk full");
      expect(() =>
        recordConversationTurnMessages({
          conversationId: "conv-turn-write-fail",
          operatorText: "test",
          assistantText: "response",
          controlRoomState: {
            nextRecommendedAction: "next",
            missingEvidence: "missing",
            browserCapture: { status: "Standby", detail: "detail" },
            monitoringExportStatus: { phase: "preview", controlId: null },
            cc81ControlMapping: { note: "note" },
            exceptionSummary: { items: [] },
            releaseVerification: { status: "At risk", freshness: "freshness" },
          },
          exceptionExportSource: CACHED_SOURCE.exceptionExportSource,
          monitoringExportStatusSource: CACHED_SOURCE.monitoringExportStatusSource,
        }),
      ).not.toThrow();
      expect(loadConversationExceptionExportExecutionSource("conv-turn-write-fail")).toEqual(CACHED_SOURCE.exceptionExportSource);
      expect(loadConversationMonitoringExecutionSource("conv-turn-write-fail")).toEqual(CACHED_SOURCE.monitoringExportStatusSource);
    });
  });
});
