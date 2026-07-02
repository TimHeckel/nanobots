import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConversationThreadMessages } from "@/lib/chat/conversation-thread-store";
import { seedExecutionSourceStore, resetExecutionSourceStore } from "@/lib/db/execution-source";
import type { ControlRoomExecutionSource } from "@/lib/chat/control-room-state";
import {
  DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
  buildExceptionSummaryState,
} from "@/lib/chat/control-room-state";
import { QUEUED_EXCEPTION_EXPORT_EXECUTION_SOURCE } from "@/lib/chat/control-room-execution-source-seed";

describe("chat route exception/export execution source contract", () => {
  beforeEach(() => {
    resetConversationThreadMessages();
    resetExecutionSourceStore();
    const defaultSource: ControlRoomExecutionSource = {
      exceptionExportSource: DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
      monitoringExportStatusSource: { phase: "preview", controlId: null },
    };
    seedExecutionSourceStore([
      { conversationId: "conv-exception-source", source: defaultSource },
    ]);
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock("@/lib/chat/exception-export-execution-source");
  });

  it("derives exception summary from the injected execution source instead of the queued default", async () => {
    const { POST } = await import("@/app/api/chat/route");

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-exception-source",
          text: "What should I do next for CC8.1?",
        }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.controlRoomState.exceptionSummary).toEqual(
      buildExceptionSummaryState(DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE),
    );
    expect(payload.controlRoomState.exceptionSummary).not.toEqual(
      buildExceptionSummaryState(QUEUED_EXCEPTION_EXPORT_EXECUTION_SOURCE),
    );
    expect(payload.controlRoomState.releaseVerification).toEqual({
      status: "At risk",
      freshness: "Missing supporting evidence",
    });
    expect(payload.controlRoomState.browserCapture).toEqual({
      status: "Standby",
      detail: "Screenshot and video evidence jobs are not configured yet.",
    });
  });
});
