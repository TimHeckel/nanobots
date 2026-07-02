import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/chat/route";
import { GET as GET_MESSAGES } from "@/app/api/conversations/[id]/messages/route";
import { resetConversationThreadMessages } from "@/lib/chat/conversation-thread-store";
import { resetControlGapStateStore } from "@/lib/db/control-gap-state";
import {
  resetEvidenceSyncStateStore,
} from "@/lib/db/evidence-sync-state";

describe("chat route evidence sync contract", () => {
  beforeEach(() => {
    resetConversationThreadMessages();
    resetControlGapStateStore();
    resetEvidenceSyncStateStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetConversationThreadMessages();
    resetControlGapStateStore();
    resetEvidenceSyncStateStore();
  });

  it("connects a GitHub evidence source through conversation and returns source-backed sync panel state", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-connect-source",
          text: "connect github acme/api",
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.message.text).toContain("Connected GitHub evidence source acme/api");
    expect(payload.syncPanelState).toEqual(
      expect.objectContaining({
        connectedSources: [
          expect.objectContaining({
            sourceId: "github:acme/api",
            status: "Connected",
          }),
        ],
        syncHealth: expect.objectContaining({
          value: "Sync pending",
        }),
      }),
    );
    expect(payload.controlRoomState.missingEvidence).toContain("GitHub PR approval evidence");
  });

  it("syncs GitHub evidence through conversation, maps controls, and surfaces sync state on thread reload", async () => {
    await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-sync-source",
          text: "connect github acme/api",
        }),
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-sync-source",
          text: "sync github acme/api",
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.message.text).toBe(
      "Synced evidence from github:acme/api and refreshed control mappings.",
    );
    expect(payload.syncPanelState.syncHealth).toEqual({
      value: "Attention required",
      detail:
        "4 mapped evidence artifacts are ready; 1 artifact requires operator mapping.",
    });
    expect(payload.syncPanelState.controlExportStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlId: "CC6.1",
          status: "Ready",
        }),
        expect.objectContaining({
          controlId: "CC8.1",
          status: "Action required (stale)",
        }),
      ]),
    );
    expect(payload.controlRoomState.missingEvidence).toContain(
      "Release approval screenshot",
    );

    const threadResponse = await GET_MESSAGES(
      new Request("http://localhost/api/conversations/conv-sync-source/messages"),
      { params: Promise.resolve({ id: "conv-sync-source" }) },
    );
    const threadPayload = await threadResponse.json();

    expect(threadPayload.syncPanelState.connectedSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "github:acme/api",
          lastSyncLabel: "Last sync 2026-03-29T12:15:00.000Z",
        }),
      ]),
    );
    expect(threadPayload.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: "Synced evidence from github:acme/api and refreshed control mappings.",
        }),
      ]),
    );
  });

  it("keeps sync panel state attached to inspect, resolve, and generic chat responses after a source is connected", async () => {
    await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-sync-followups",
          text: "connect github acme/api",
        }),
      }),
    );

    const inspect = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-sync-followups",
          text: "show control gaps",
        }),
      }),
    );
    const inspectPayload = await inspect.json();
    expect(inspectPayload.syncPanelState).toEqual(
      expect.objectContaining({
        connectedSources: expect.arrayContaining([
          expect.objectContaining({
            sourceId: "github:acme/api",
          }),
        ]),
      }),
    );

    const resolve = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-sync-followups",
          text: "Attach evidence to CC8.1",
        }),
      }),
    );
    const resolvePayload = await resolve.json();
    expect(resolvePayload.syncPanelState).toEqual(
      expect.objectContaining({
        connectedSources: expect.arrayContaining([
          expect.objectContaining({
            sourceId: "github:acme/api",
          }),
        ]),
      }),
    );

    const generic = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conv-sync-followups",
          text: "What should I do next for CC8.1?",
        }),
      }),
    );
    const genericPayload = await generic.json();
    expect(genericPayload.syncPanelState).toEqual(
      expect.objectContaining({
        connectedSources: expect.arrayContaining([
          expect.objectContaining({
            sourceId: "github:acme/api",
          }),
        ]),
      }),
    );
  });
});
