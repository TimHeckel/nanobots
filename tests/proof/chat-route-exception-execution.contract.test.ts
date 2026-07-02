import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordConversationExceptionExportExecutionSource,
  resetConversationThreadMessages,
} from "@/lib/chat/conversation-thread-store";
import { DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE } from "@/lib/chat/control-room-state";
import { QUEUED_EXCEPTION_EXPORT_EXECUTION_SOURCE, QUEUED_CONTROL_ROOM_EXECUTION_SOURCE } from "@/lib/chat/control-room-execution-source-seed";
import { seedExecutionSourceStore, resetExecutionSourceStore } from "@/lib/db/execution-source";
import {
  loadExceptionExportExecutionSource,
} from "@/lib/chat/exception-export-execution-source";

describe("chat route exception/export execution seam", () => {
  beforeEach(() => {
    resetConversationThreadMessages();
    resetExecutionSourceStore();
    seedExecutionSourceStore([
      { conversationId: "conv-exception-execution-new", source: QUEUED_CONTROL_ROOM_EXECUTION_SOURCE },
      { conversationId: "conv-exception-execution-source", source: QUEUED_CONTROL_ROOM_EXECUTION_SOURCE },
    ]);
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock("@/lib/chat/control-room-state");
    vi.unmock("@/lib/chat/exception-export-execution-source");
  });

  it("loads the structured execution source from the adapter boundary", async () => {
    await recordConversationExceptionExportExecutionSource({
      conversationId: "conv-exception-execution-source",
      exceptionExportSource: DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
    });

    await expect(
      loadExceptionExportExecutionSource({
        conversationId: "conv-exception-execution-source",
        text: "What should I do next for CC8.1?",
      }),
    ).resolves.toEqual(DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE);
  });

  it("uses the adapter-owned queued execution source for a new conversation", async () => {
    await expect(
      loadExceptionExportExecutionSource({
        conversationId: "conv-exception-execution-new",
        text: "What should I do next for CC8.1?",
      }),
    ).resolves.toEqual(QUEUED_EXCEPTION_EXPORT_EXECUTION_SOURCE);
  });

  it("passes the adapter execution source into the shared builder instead of any queued fallback", async () => {
    await recordConversationExceptionExportExecutionSource({
      conversationId: "conv-exception-execution-source",
      exceptionExportSource: DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
    });

    const buildGapResolutionControlRoomState = vi.fn(() => ({
      nextRecommendedAction: "next",
      missingEvidence: "missing",
      browserCapture: { status: "Standby", detail: "detail" },
      monitoringExportStatus: { phase: "preview", controlId: null },
      cc81ControlMapping: { note: "note" },
      exceptionSummary: { items: ["exception"] },
      releaseVerification: { status: "At risk", freshness: "freshness" },
    }));

    vi.doMock("@/lib/chat/control-room-state", async () => {
      const actual =
        await vi.importActual<typeof import("@/lib/chat/control-room-state")>(
          "@/lib/chat/control-room-state",
        );

      return {
        ...actual,
        buildGapResolutionControlRoomState,
      };
    });

    const { POST } = await import("@/app/api/chat/route");

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-exception-execution-source",
          text: "What should I do next for CC8.1?",
        }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(buildGapResolutionControlRoomState).toHaveBeenCalledWith(
      expect.objectContaining({
        exceptionExportSource: DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
      }),
    );
    expect(buildGapResolutionControlRoomState).not.toHaveBeenCalledWith(
      expect.objectContaining({
        exceptionExportSource: QUEUED_EXCEPTION_EXPORT_EXECUTION_SOURCE,
      }),
    );
    expect(payload.controlRoomState.exceptionSummary).toEqual({
      items: ["exception"],
    });
  });
});
