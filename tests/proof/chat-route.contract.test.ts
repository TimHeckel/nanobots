import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";
import { resetConversationThreadMessages } from "@/lib/chat/conversation-thread-store";
import { buildGapResolutionControlRoomState } from "@/lib/chat/control-room-state";
import { QUEUED_CONTROL_ROOM_EXECUTION_SOURCE } from "@/lib/chat/control-room-execution-source-seed";
import { seedExecutionSourceStore, resetExecutionSourceStore } from "@/lib/db/execution-source";

describe("chat route contract", () => {
  beforeEach(() => {
    resetConversationThreadMessages();
    resetExecutionSourceStore();
    seedExecutionSourceStore([
      { conversationId: "conv-control-gap", source: QUEUED_CONTROL_ROOM_EXECUTION_SOURCE },
    ]);
  });

  it("returns 400 for a request with malformed JSON body", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "not valid json{{{" ,
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      surface: "operator-control-room",
      conversationId: null,
      error: "Conversation route unavailable",
    });
  });

  it("returns a deterministic route-backed control-room reply", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-control-gap",
          text: "What should I do next for CC8.1?",
        }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      surface: "operator-control-room",
      conversationId: "conv-control-gap",
      message: {
        id: "assistant-conv-control-gap",
        role: "assistant",
        text: "Route-backed next action: capture the release approval screenshot and resync Sprinto.",
      },
      controlRoomState: {
        ...buildGapResolutionControlRoomState(QUEUED_CONTROL_ROOM_EXECUTION_SOURCE),
      },
    });
  });

  it("returns a degraded control-health delta when the route cannot derive panel state", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-control-gap",
          text: "force missing control health delta",
        }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      surface: "operator-control-room",
      conversationId: "conv-control-gap",
      message: {
        id: "assistant-conv-control-gap",
        role: "assistant",
        text: "Route-backed next action: capture the release approval screenshot and resync Sprinto.",
      },
      controlRoomState: {
        ...buildGapResolutionControlRoomState(QUEUED_CONTROL_ROOM_EXECUTION_SOURCE),
        releaseVerification: undefined,
      },
    });
  });

  it("returns an auditable error when the operator message is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-control-gap",
          text: "   ",
        }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      surface: "operator-control-room",
      conversationId: "conv-control-gap",
      error: "Operator message is required",
    });
  });

  it("returns an auditable route failure for the deterministic failure sentinel", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-control-gap",
          text: "force chat route failure",
        }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      surface: "operator-control-room",
      conversationId: "conv-control-gap",
      error: "Control-room response unavailable. Retry the operator request.",
    });
  });
  it("falls back to new conversation id when conversationId is omitted", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: "What should I do next for CC8.1?",
        }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.conversationId).toBe("new");
  });
});
