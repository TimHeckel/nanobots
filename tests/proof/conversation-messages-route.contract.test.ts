import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";
import { GET } from "@/app/api/conversations/[id]/messages/route";
import {
  clearConversationControlRoomExecutionSource,
  resetConversationThreadMessages,
} from "@/lib/chat/conversation-thread-store";
import {
  DEFAULT_CHAT_CONTROL_ROOM_STATE,
  buildUnavailableDerivedControlRoomState,
  buildGapResolutionControlRoomState,
} from "@/lib/chat/control-room-state";
import { QUEUED_CONTROL_ROOM_EXECUTION_SOURCE } from "@/lib/chat/control-room-execution-source-seed";
import { seedExecutionSourceStore, resetExecutionSourceStore } from "@/lib/db/execution-source";

describe("conversation messages route contract", () => {
  beforeEach(() => {
    resetConversationThreadMessages();
    resetExecutionSourceStore();
    seedExecutionSourceStore([
      { conversationId: "conv-thread-roundtrip", source: QUEUED_CONTROL_ROOM_EXECUTION_SOURCE },
      { conversationId: "conv-thread-missing-execution-source", source: QUEUED_CONTROL_ROOM_EXECUTION_SOURCE },
    ]);
  });

  it("returns the minimal control-room conversation messages payload", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "conv-control-gap" }),
    });
    const payload = await response.json();

    expect(payload).toEqual({
      surface: "operator-control-room",
      conversationId: "conv-control-gap",
      messages: [
        {
          id: "msg-gap-summary",
          role: "assistant",
          text: "Missing evidence: incident response walkthrough recording.",
        },
      ],
      controlRoomState: buildGapResolutionControlRoomState(
        QUEUED_CONTROL_ROOM_EXECUTION_SOURCE,
      ),
    });
  });

  it("round-trips a successful chat turn back through the route-backed messages payload", async () => {
    await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-thread-roundtrip",
          text: "What should I do next for CC8.1?",
        }),
      }),
    );

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "conv-thread-roundtrip" }),
    });
    const payload = await response.json();

    expect(payload).toEqual({
      surface: "operator-control-room",
      conversationId: "conv-thread-roundtrip",
      messages: [
        {
          id: "msg-gap-summary",
          role: "assistant",
          text: "Missing evidence: incident response walkthrough recording.",
        },
        {
          id: "operator-conv-thread-roundtrip-1",
          role: "operator",
          text: "What should I do next for CC8.1?",
        },
        {
          id: "assistant-conv-thread-roundtrip-2",
          role: "assistant",
          text: "Route-backed next action: capture the release approval screenshot and resync Sprinto.",
        },
      ],
      controlRoomState: buildGapResolutionControlRoomState(
        QUEUED_CONTROL_ROOM_EXECUTION_SOURCE,
      ),
    });
  });

  it("keeps the route-backed thread unchanged when the chat route fails", async () => {
    await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-thread-failure",
          text: "force chat route failure",
        }),
      }),
    );

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "conv-thread-failure" }),
    });
    const payload = await response.json();

    expect(payload).toEqual({
      surface: "operator-control-room",
      conversationId: "conv-thread-failure",
      messages: [
        {
          id: "msg-gap-summary",
          role: "assistant",
          text: "Missing evidence: incident response walkthrough recording.",
        },
      ],
      controlRoomState: buildGapResolutionControlRoomState(
        QUEUED_CONTROL_ROOM_EXECUTION_SOURCE,
      ),
    });
  });

  it("returns an explicit unavailable control-room state when the persisted execution source record is missing", async () => {
    const conversationId = "conv-thread-missing-execution-source";

    await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          text: "What should I do next for CC8.1?",
        }),
      }),
    );

    clearConversationControlRoomExecutionSource(conversationId);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: conversationId }),
    });
    const payload = await response.json();

    expect(payload).toEqual({
      surface: "operator-control-room",
      conversationId,
      messages: [
        {
          id: "msg-gap-summary",
          role: "assistant",
          text: "Missing evidence: incident response walkthrough recording.",
        },
        {
          id: `operator-${conversationId}-1`,
          role: "operator",
          text: "What should I do next for CC8.1?",
        },
        {
          id: `assistant-${conversationId}-2`,
          role: "assistant",
          text: "Route-backed next action: capture the release approval screenshot and resync Sprinto.",
        },
      ],
      controlRoomState: buildUnavailableDerivedControlRoomState(),
    });
  });
});
