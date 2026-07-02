import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ControlRoomExecutionSource,
  ChatControlRoomState,
} from "@/lib/chat/control-room-state";
import {
  buildGapResolutionControlRoomState,
} from "@/lib/chat/control-room-state";

// ---------------------------------------------------------------------------
// Durable DB shim — survives globalThis cache clears, just like Neon would.
// ---------------------------------------------------------------------------
const durableDbStore = new Map<string, unknown>();

vi.mock("@/lib/db/queries/execution-sources", () => ({
  getExecutionSource: vi.fn(async (conversationId: string) => {
    return durableDbStore.get(conversationId) ?? null;
  }),
  upsertExecutionSource: vi.fn(async (row: unknown) => {
    durableDbStore.set((row as { conversation_id: string }).conversation_id, row);
  }),
}));

// ---------------------------------------------------------------------------
// Source fixtures — one per distinct enum combination.
// ---------------------------------------------------------------------------
const QUEUED_SOURCE: ControlRoomExecutionSource = {
  exceptionExportSource: {
    browserCapturePhase: "queued",
    releaseVerificationPhase: "capture-queued",
  },
  monitoringExportStatusSource: {
    phase: "evidence-refresh-queued",
    controlId: "CC8.1",
  },
};

const UNAVAILABLE_SOURCE: ControlRoomExecutionSource = {
  exceptionExportSource: {
    browserCapturePhase: "unavailable",
    releaseVerificationPhase: "unavailable",
  },
  monitoringExportStatusSource: {
    phase: "unavailable",
    controlId: null,
  },
};

const STANDBY_SOURCE: ControlRoomExecutionSource = {
  exceptionExportSource: {
    browserCapturePhase: "standby",
    releaseVerificationPhase: "at-risk",
  },
  monitoringExportStatusSource: {
    phase: "preview",
    controlId: null,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clearProcessCaches() {
  delete (globalThis as any).__nanobotsExecutionSourceStore;
  delete (globalThis as any).__nanobotsConversationThreadStore;
}

function assertFullDerivedStateMatch(
  actual: ChatControlRoomState,
  source: ControlRoomExecutionSource,
  label: string,
) {
  const expected = buildGapResolutionControlRoomState(source);

  expect(actual.browserCapture, `${label}: browserCapture`).toEqual(
    expected.browserCapture,
  );
  expect(
    actual.releaseVerification,
    `${label}: releaseVerification`,
  ).toEqual(expected.releaseVerification);
  expect(
    actual.exceptionSummary,
    `${label}: exceptionSummary`,
  ).toEqual(expected.exceptionSummary);
  expect(
    actual.monitoringExportStatus,
    `${label}: monitoringExportStatus`,
  ).toEqual(expected.monitoringExportStatus);
  expect(
    actual.cc81ControlMapping,
    `${label}: cc81ControlMapping`,
  ).toEqual(expected.cc81ControlMapping);
  expect(
    actual.nextRecommendedAction,
    `${label}: nextRecommendedAction`,
  ).toEqual(expected.nextRecommendedAction);
  expect(
    actual.missingEvidence,
    `${label}: missingEvidence`,
  ).toEqual(expected.missingEvidence);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("derived-state roundtrip contract", () => {
  beforeEach(() => {
    durableDbStore.clear();
    clearProcessCaches();
  });

  afterEach(() => {
    durableDbStore.clear();
    clearProcessCaches();
  });

  describe("save -> clear -> reload -> derive (builder layer)", () => {
    it("queued source: every derived field matches after roundtrip", async () => {
      const { savePersistedControlRoomExecutionSource } = await import(
        "@/lib/chat/control-room-execution-source-seed"
      );
      const { buildConversationThreadState } = await import(
        "@/lib/chat/conversation-thread-store"
      );

      await savePersistedControlRoomExecutionSource("conv-rt-queued", QUEUED_SOURCE);
      clearProcessCaches();

      const { controlRoomState } = await buildConversationThreadState("conv-rt-queued");

      assertFullDerivedStateMatch(controlRoomState, QUEUED_SOURCE, "queued roundtrip");
    });

    it("unavailable source: no default leakage after roundtrip", async () => {
      const { savePersistedControlRoomExecutionSource } = await import(
        "@/lib/chat/control-room-execution-source-seed"
      );
      const { buildConversationThreadState } = await import(
        "@/lib/chat/conversation-thread-store"
      );

      await savePersistedControlRoomExecutionSource("conv-rt-unavail", UNAVAILABLE_SOURCE);
      clearProcessCaches();

      const { controlRoomState } = await buildConversationThreadState("conv-rt-unavail");

      assertFullDerivedStateMatch(
        controlRoomState,
        UNAVAILABLE_SOURCE,
        "unavailable roundtrip",
      );

      // Explicitly assert these are NOT the default/queued values
      expect(controlRoomState.browserCapture.status).not.toBe("Standby");
      expect(controlRoomState.browserCapture.status).not.toBe("Queued");
      expect(controlRoomState.releaseVerification.status).not.toBe("At risk");
      expect(controlRoomState.releaseVerification.status).not.toBe("Capture queued");
      expect(controlRoomState.monitoringExportStatus.phase).toBe("unavailable");
    });

    it("standby/at-risk source: default derivatives preserved, not queued", async () => {
      const { savePersistedControlRoomExecutionSource } = await import(
        "@/lib/chat/control-room-execution-source-seed"
      );
      const { buildConversationThreadState } = await import(
        "@/lib/chat/conversation-thread-store"
      );

      await savePersistedControlRoomExecutionSource("conv-rt-standby", STANDBY_SOURCE);
      clearProcessCaches();

      const { controlRoomState } = await buildConversationThreadState("conv-rt-standby");

      assertFullDerivedStateMatch(
        controlRoomState,
        STANDBY_SOURCE,
        "standby roundtrip",
      );

      expect(controlRoomState.browserCapture.status).toBe("Standby");
      expect(controlRoomState.releaseVerification.status).toBe("At risk");
      expect(controlRoomState.monitoringExportStatus.phase).toBe("preview");
      expect(controlRoomState.monitoringExportStatus.controlId).toBeNull();
    });
  });

  describe("messages route projection after roundtrip", () => {
    it("queued source: messages route returns full derived panel state", async () => {
      const { savePersistedControlRoomExecutionSource } = await import(
        "@/lib/chat/control-room-execution-source-seed"
      );

      await savePersistedControlRoomExecutionSource("conv-proj-queued", QUEUED_SOURCE);
      clearProcessCaches();

      const { GET } = await import(
        "@/app/api/conversations/[id]/messages/route"
      );

      const response = await GET(
        new Request("http://localhost/api/conversations/conv-proj-queued/messages"),
        { params: Promise.resolve({ id: "conv-proj-queued" }) },
      );
      const payload = await response.json();

      expect(payload.controlRoomState).toBeDefined();
      assertFullDerivedStateMatch(
        payload.controlRoomState,
        QUEUED_SOURCE,
        "messages route queued projection",
      );
    });

    it("unavailable source: messages route returns unavailable panel state, not defaults", async () => {
      const { savePersistedControlRoomExecutionSource } = await import(
        "@/lib/chat/control-room-execution-source-seed"
      );

      await savePersistedControlRoomExecutionSource("conv-proj-unavail", UNAVAILABLE_SOURCE);
      clearProcessCaches();

      const { GET } = await import(
        "@/app/api/conversations/[id]/messages/route"
      );

      const response = await GET(
        new Request("http://localhost/api/conversations/conv-proj-unavail/messages"),
        { params: Promise.resolve({ id: "conv-proj-unavail" }) },
      );
      const payload = await response.json();

      expect(payload.controlRoomState).toBeDefined();
      assertFullDerivedStateMatch(
        payload.controlRoomState,
        UNAVAILABLE_SOURCE,
        "messages route unavailable projection",
      );

      // Guard: route must not silently return default/queued values
      expect(payload.controlRoomState.browserCapture.status).toBe("Unavailable");
      expect(payload.controlRoomState.releaseVerification.status).toBe("Unavailable");
      expect(payload.controlRoomState.monitoringExportStatus.phase).toBe("unavailable");
    });
  });
});
