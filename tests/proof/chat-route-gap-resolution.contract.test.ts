import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/chat/route";
import { GET as GET_MESSAGES } from "@/app/api/conversations/[id]/messages/route";
import {
  resetConversationThreadMessages,
} from "@/lib/chat/conversation-thread-store";
import {
  resetControlGapStateStore,
  seedControlGapState,
} from "@/lib/db/control-gap-state";
import { createDefaultControlGapState } from "@/lib/chat/control-gap-state";

describe("chat route gap resolution contract", () => {
  beforeEach(() => {
    resetConversationThreadMessages();
    resetControlGapStateStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetConversationThreadMessages();
    resetControlGapStateStore();
  });

  it("identifies actionable control gaps through the chat route", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-gap-route",
          text: "show control gaps",
        }),
      }),
    );

    const payload = await response.json();

    expect(payload.gaps).toEqual([
      expect.objectContaining({
        controlId: "CC8.1",
        status: "missing",
      }),
    ]);
    expect(payload.controlRoomState.missingEvidence).toContain(
      "Release approval screenshot",
    );
  });

  it("attaches evidence through conversation and updates the structured side-panel state on reload", async () => {
    await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-gap-resolve",
          text: "Attach evidence to CC8.1",
        }),
      }),
    );

    const response = await GET_MESSAGES(
      new Request("http://localhost/api/conversations/conv-gap-resolve/messages"),
      { params: Promise.resolve({ id: "conv-gap-resolve" }) },
    );
    const payload = await response.json();

    expect(payload.controlRoomState).toEqual(
      expect.objectContaining({
        missingEvidence: "No missing evidence. All tracked controls are ready for Sprinto.",
        monitoringExportStatus: { phase: "preview", controlId: null },
      }),
    );
    expect(payload.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: "Attached new evidence to CC8.1 and cleared the active gap.",
        }),
      ]),
    );
  });

  it("queues a refresh and surfaces the queued control-health delta after a conversational re-scan request", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-gap-rescan",
          text: "Rerun scan for CC8.1",
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.controlRoomState.monitoringExportStatus).toEqual({
      phase: "evidence-refresh-queued",
      controlId: "CC8.1",
    });
    expect(payload.controlRoomState.releaseVerification.status).toBe(
      "Capture queued",
    );
  });

  it("refuses gap mutations while the control is mid-export", async () => {
    const syncing = createDefaultControlGapState("conv-gap-syncing");
    syncing.controls[0].exportPhase = "syncing";
    seedControlGapState("conv-gap-syncing", syncing);

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-gap-syncing",
          text: "Attach evidence to CC8.1",
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.message.text).toContain("mid-export");
    expect(payload.mutatedControl).toEqual(
      expect.objectContaining({
        exportPhase: "syncing",
      }),
    );
    expect(payload.controlRoomState.missingEvidence).toContain(
      "Release approval screenshot",
    );
  });

  it("supports manual review and escalation commands through the chat route", async () => {
    const manualReview = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-gap-manual",
          text: "Mark CC8.1 for manual review",
        }),
      }),
    );
    const manualPayload = await manualReview.json();

    expect(manualPayload.message.text).toContain("manually reviewed");
    expect(manualPayload.controlRoomState.missingEvidence).toBe(
      "No missing evidence. All tracked controls are ready for Sprinto.",
    );

    const escalated = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-gap-escalate",
          text: "Escalate CC8.1",
        }),
      }),
    );
    const escalatePayload = await escalated.json();

    expect(escalatePayload.message.text).toContain("Escalated CC8.1");
    expect(escalatePayload.controlRoomState.releaseVerification.status).toBe(
      "Blocked",
    );

    const healthyInspect = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-gap-manual",
          text: "what evidence is missing?",
        }),
      }),
    );
    const healthyPayload = await healthyInspect.json();

    expect(healthyPayload.message.text).toBe(
      "All tracked controls are currently healthy.",
    );
    expect(healthyPayload.gaps).toEqual([]);
  });
});
