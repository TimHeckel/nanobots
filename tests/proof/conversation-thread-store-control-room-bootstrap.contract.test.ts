import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGapResolutionControlRoomState,
  DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
} from "@/lib/chat/control-room-state";
import { QUEUED_CONTROL_ROOM_EXECUTION_SOURCE } from "@/lib/chat/control-room-execution-source-seed";
import { seedExecutionSourceStore, resetExecutionSourceStore } from "@/lib/db/execution-source";

describe("conversation thread store control-room bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    resetExecutionSourceStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    resetExecutionSourceStore();
  });

  it("bootstraps a new conversation from the persistence adapter boundary instead of the queued resolver fallback", async () => {
    const persistedExecutionSource = {
      exceptionExportSource: DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
      monitoringExportStatusSource:
        QUEUED_CONTROL_ROOM_EXECUTION_SOURCE.monitoringExportStatusSource,
    };

    seedExecutionSourceStore([
      { conversationId: "conv-control-room-bootstrap", source: persistedExecutionSource },
    ]);

    const {
      loadConversationControlRoomExecutionSource,
      resetConversationThreadMessages,
    } = await import("@/lib/chat/conversation-thread-store");
    const { loadControlRoomExecutionSource } = await import(
      "@/lib/chat/control-room-execution-source"
    );
    const { POST } = await import("@/app/api/chat/route");

    resetConversationThreadMessages();

    expect(
      await loadConversationControlRoomExecutionSource("conv-control-room-bootstrap"),
    ).toEqual(persistedExecutionSource);

    await expect(
      loadControlRoomExecutionSource({
        conversationId: "conv-control-room-bootstrap",
        text: "What should I do next for CC8.1?",
      }),
    ).resolves.toEqual(persistedExecutionSource);

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-control-room-bootstrap",
          text: "What should I do next for CC8.1?",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.controlRoomState.exceptionSummary).toEqual(
      buildGapResolutionControlRoomState(persistedExecutionSource)
        .exceptionSummary,
    );
    expect(payload.controlRoomState.exceptionSummary).not.toEqual(
      buildGapResolutionControlRoomState(QUEUED_CONTROL_ROOM_EXECUTION_SOURCE)
        .exceptionSummary,
    );
  });
});
