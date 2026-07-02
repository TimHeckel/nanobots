import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordConversationMonitoringExecutionSource,
  resetConversationThreadMessages,
} from "@/lib/chat/conversation-thread-store";
import {
  DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
  buildGapResolutionControlRoomState,
} from "@/lib/chat/control-room-state";
import {
  loadControlRoomExecutionSource,
} from "@/lib/chat/control-room-execution-source";
import { QUEUED_CONTROL_ROOM_EXECUTION_SOURCE } from "@/lib/chat/control-room-execution-source-seed";
import { seedExecutionSourceStore, resetExecutionSourceStore } from "@/lib/db/execution-source";

describe("chat route monitoring execution seam", () => {
  beforeEach(() => {
    resetConversationThreadMessages();
    resetExecutionSourceStore();
    seedExecutionSourceStore([
      { conversationId: "conv-monitoring-execution-source", source: QUEUED_CONTROL_ROOM_EXECUTION_SOURCE },
    ]);
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("loads the persisted monitoring execution source from the resolver boundary", async () => {
    await recordConversationMonitoringExecutionSource({
      conversationId: "conv-monitoring-execution-source",
      monitoringExportStatusSource: DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
    });

    await expect(
      loadControlRoomExecutionSource({
        conversationId: "conv-monitoring-execution-source",
        text: "What monitoring should happen after CC8.1 evidence is attached?",
      }),
    ).resolves.toEqual({
      exceptionExportSource:
        QUEUED_CONTROL_ROOM_EXECUTION_SOURCE.exceptionExportSource,
      monitoringExportStatusSource: DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
    });
  });

  it("derives the route-backed monitoring state from the persisted execution source instead of the queued default", async () => {
    await recordConversationMonitoringExecutionSource({
      conversationId: "conv-monitoring-execution-source",
      monitoringExportStatusSource: DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
    });

    const { POST } = await import("@/app/api/chat/route");

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-monitoring-execution-source",
          text: "What monitoring should happen after CC8.1 evidence is attached?",
        }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.controlRoomState).toMatchObject(
      buildGapResolutionControlRoomState({
        exceptionExportSource:
          QUEUED_CONTROL_ROOM_EXECUTION_SOURCE.exceptionExportSource,
        monitoringExportStatusSource: DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
      }),
    );
    expect(payload.controlRoomState.monitoringExportStatus).toEqual(
      DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
    );
    expect(payload.controlRoomState.monitoringExportStatus).not.toEqual(
      QUEUED_CONTROL_ROOM_EXECUTION_SOURCE.monitoringExportStatusSource,
    );
  });
});
