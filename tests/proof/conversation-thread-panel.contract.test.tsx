import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadConversationThreadState,
  ConversationThreadPanelView,
  ConversationThreadPanel,
  refreshConversationThread,
} from "@/components/control-room/conversation-thread-panel";
import type { RefreshConversationThreadSetters } from "@/components/control-room/conversation-thread-panel";
import {
  UNAVAILABLE_BROWSER_CAPTURE_EVIDENCE_STATE,
  UNAVAILABLE_RELEASE_VERIFICATION_STATE,
  UNAVAILABLE_MONITORING_EXPORT_STATUS_SOURCE,
  DEFAULT_CHAT_CONTROL_ROOM_STATE,
  UNAVAILABLE_EXCEPTION_SUMMARY_STATE,
} from "@/lib/chat/control-room-state";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

describe("conversation thread panel contract", () => {
  describe("loadConversationThreadState", () => {
    it("reloads thread state with an uncached messages request", async () => {
      const fetchImpl = mockFetch(200, {
        surface: "operator-control-room",
        conversationId: "conv-1",
        messages: [],
      });

      await loadConversationThreadState("conv-1", fetchImpl);

      expect(fetchImpl).toHaveBeenCalledWith(
        "/api/conversations/conv-1/messages",
        { cache: "no-store" },
      );
    });

    it("returns success when the response is ok with messages", async () => {
      const fetchImpl = mockFetch(200, {
        surface: "operator-control-room",
        conversationId: "conv-ok",
        messages: [{ id: "m1", role: "assistant", text: "hello" }],
      });

      const result = await loadConversationThreadState("conv-ok", fetchImpl);
      expect(result.kind).toBe("success");
    });

    it("returns failure with error field from a non-ok response", async () => {
      const fetchImpl = mockFetch(500, {
        surface: "operator-control-room",
        conversationId: "conv-err",
        error: "Server error",
      });

      const result = await loadConversationThreadState("conv-err", fetchImpl);
      expect(result.kind).toBe("failure");
      if (result.kind === "failure") {
        expect(result.payload.error).toBe("Server error");
      }
    });

    it("returns failure with fallback error when payload lacks error field", async () => {
      const fetchImpl = mockFetch(500, {
        surface: "operator-control-room",
        conversationId: "conv-no-err",
      });

      const result = await loadConversationThreadState("conv-no-err", fetchImpl);
      expect(result.kind).toBe("failure");
      if (result.kind === "failure") {
        expect(result.payload.error).toBe("Conversation thread unavailable");
      }
    });

    it("returns failure when response is ok but payload has no messages", async () => {
      const fetchImpl = mockFetch(200, {
        surface: "operator-control-room",
        conversationId: "conv-no-msg",
        error: "Malformed",
      });

      const result = await loadConversationThreadState("conv-no-msg", fetchImpl);
      expect(result.kind).toBe("failure");
    });
  });

  describe("ConversationThreadPanelView", () => {
    const noop = () => {};

    it("renders the loading state", () => {
      const markup = renderToStaticMarkup(
        <ConversationThreadPanelView
          state={{ kind: "loading" }}
          isRefreshing={false}
          onReload={noop}
        />,
      );

      expect(markup).toContain("Conversation Thread");
      expect(markup).toContain("Loading thread from the operator message route.");
    });

    it("renders the failure state with reload button", () => {
      const markup = renderToStaticMarkup(
        <ConversationThreadPanelView
          state={{
            kind: "failure",
            payload: {
              surface: "operator-control-room",
              conversationId: "conv-fail",
              error: "Thread unavailable",
            },
          }}
          isRefreshing={false}
          onReload={noop}
        />,
      );

      expect(markup).toContain("Thread unavailable");
      expect(markup).toContain("Reload thread");
    });

    it("renders Reloading thread when isRefreshing is true in failure state", () => {
      const markup = renderToStaticMarkup(
        <ConversationThreadPanelView
          state={{
            kind: "failure",
            payload: {
              surface: "operator-control-room",
              conversationId: "conv-fail",
              error: "Thread unavailable",
            },
          }}
          isRefreshing={true}
          onReload={noop}
        />,
      );

      expect(markup).toContain("Reloading thread");
    });

    it("renders the success state with messages", () => {
      const markup = renderToStaticMarkup(
        <ConversationThreadPanelView
          state={{
            kind: "success",
            payload: {
              surface: "operator-control-room",
              conversationId: "conv-ok",
              messages: [
                { id: "m1", role: "operator", text: "What about CC8.1?" },
                { id: "m2", role: "assistant", text: "Capture the screenshot." },
              ],
            },
          }}
          isRefreshing={false}
          onReload={noop}
        />,
      );

      expect(markup).toContain("What about CC8.1?");
      expect(markup).toContain("Capture the screenshot.");
      expect(markup).toContain("operator");
      expect(markup).toContain("assistant");
      expect(markup).toContain("Reload thread");
    });

    it("renders Reloading thread when isRefreshing is true in success state", () => {
      const markup = renderToStaticMarkup(
        <ConversationThreadPanelView
          state={{
            kind: "success",
            payload: {
              surface: "operator-control-room",
              conversationId: "conv-ok",
              messages: [],
            },
          }}
          isRefreshing={true}
          onReload={noop}
        />,
      );

      expect(markup).toContain("Reloading thread");
    });
  });

  describe("refreshConversationThread", () => {
    function buildSetters(): RefreshConversationThreadSetters & Record<string, ReturnType<typeof vi.fn>> {
      return {
        setState: vi.fn(),
        setIsRefreshing: vi.fn(),
        setNextRecommendedAction: vi.fn(),
        setMissingEvidence: vi.fn(),
        setBrowserCapture: vi.fn(),
        setMonitoringExportStatus: vi.fn(),
        setExceptionSummary: vi.fn(),
        setReleaseVerificationStatus: vi.fn(),
        setReleaseVerificationFreshness: vi.fn(),
        setSyncPanelState: vi.fn(),
      };
    }

    it("pushes control room state from a successful response with controlRoomState", async () => {
      const setters = buildSetters();
      const fetchImpl = mockFetch(200, {
        surface: "operator-control-room",
        conversationId: "conv-refresh",
        messages: [],
        controlRoomState: {
          nextRecommendedAction: "Attach screenshot",
          missingEvidence: "Missing screenshot",
          browserCapture: { status: "Queued", detail: "queued detail" },
          monitoringExportStatus: { phase: "evidence-refresh-queued", controlId: "CC8.1" },
          cc81ControlMapping: { note: "mapping note" },
          exceptionSummary: { items: ["exception item"] },
          releaseVerification: { status: "Capture queued", freshness: "queued freshness" },
        },
        syncPanelState: {
          connectedSources: [
            {
              sourceId: "github:acme/api",
              name: "GitHub acme/api",
              status: "Synced",
              detail: "5 evidence artifacts normalized from acme/api.",
              lastSyncLabel: "Last sync 2026-03-29T12:15:00.000Z",
            },
          ],
          syncHealth: {
            value: "Attention required",
            detail: "4 mapped evidence artifacts are ready; 1 artifact requires operator mapping.",
          },
          controlExportStatuses: [],
        },
      });

      await refreshConversationThread("conv-refresh", setters, fetchImpl);

      expect(setters.setIsRefreshing).toHaveBeenCalledWith(true);
      expect(setters.setNextRecommendedAction).toHaveBeenCalledWith("Attach screenshot");
      expect(setters.setMissingEvidence).toHaveBeenCalledWith("Missing screenshot");
      expect(setters.setBrowserCapture).toHaveBeenCalledWith({ status: "Queued", detail: "queued detail" });
      expect(setters.setReleaseVerificationStatus).toHaveBeenCalledWith("Capture queued");
      expect(setters.setReleaseVerificationFreshness).toHaveBeenCalledWith("queued freshness");
      expect(setters.setSyncPanelState).toHaveBeenCalledWith(
        expect.objectContaining({
          connectedSources: expect.arrayContaining([
            expect.objectContaining({
              sourceId: "github:acme/api",
            }),
          ]),
        }),
      );
      expect(setters.setState).toHaveBeenCalledWith(expect.objectContaining({ kind: "success" }));
      expect(setters.setIsRefreshing).toHaveBeenCalledWith(false);
    });

    it("uses degraded release verification when controlRoomState omits releaseVerification", async () => {
      const setters = buildSetters();
      const fetchImpl = mockFetch(200, {
        surface: "operator-control-room",
        conversationId: "conv-degraded",
        messages: [],
        controlRoomState: {
          nextRecommendedAction: "action",
          missingEvidence: "evidence",
          browserCapture: { status: "Queued", detail: "detail" },
          monitoringExportStatus: { phase: "preview", controlId: null },
          cc81ControlMapping: { note: "note" },
          exceptionSummary: { items: [] },
        },
      });

      await refreshConversationThread("conv-degraded", setters, fetchImpl);

      expect(setters.setReleaseVerificationStatus).toHaveBeenCalledWith("Unavailable");
      expect(setters.setReleaseVerificationFreshness).toHaveBeenCalledWith(
        "Control health delta unavailable from the operator route.",
      );
    });

    it("pushes unavailable defaults when controlRoomState is missing from success payload", async () => {
      const setters = buildSetters();
      const fetchImpl = mockFetch(200, {
        surface: "operator-control-room",
        conversationId: "conv-no-ctrl",
        messages: [],
      });

      await refreshConversationThread("conv-no-ctrl", setters, fetchImpl);

      expect(setters.setBrowserCapture).toHaveBeenCalledWith(UNAVAILABLE_BROWSER_CAPTURE_EVIDENCE_STATE);
      expect(setters.setReleaseVerificationStatus).toHaveBeenCalledWith(UNAVAILABLE_RELEASE_VERIFICATION_STATE.status);
      expect(setters.setReleaseVerificationFreshness).toHaveBeenCalledWith(UNAVAILABLE_RELEASE_VERIFICATION_STATE.freshness);
      expect(setters.setNextRecommendedAction).toHaveBeenCalledWith(DEFAULT_CHAT_CONTROL_ROOM_STATE.nextRecommendedAction);
      expect(setters.setMissingEvidence).toHaveBeenCalledWith(DEFAULT_CHAT_CONTROL_ROOM_STATE.missingEvidence);
      expect(setters.setMonitoringExportStatus).toHaveBeenCalledWith(UNAVAILABLE_MONITORING_EXPORT_STATUS_SOURCE);
      expect(setters.setExceptionSummary).toHaveBeenCalledWith(UNAVAILABLE_EXCEPTION_SUMMARY_STATE);
    });

    it("does not push control room setters on failure response", async () => {
      const setters = buildSetters();
      const fetchImpl = mockFetch(500, {
        surface: "operator-control-room",
        conversationId: "conv-fail",
        error: "Server error",
      });

      await refreshConversationThread("conv-fail", setters, fetchImpl);

      expect(setters.setState).toHaveBeenCalledWith(expect.objectContaining({ kind: "failure" }));
      expect(setters.setNextRecommendedAction).not.toHaveBeenCalled();
      expect(setters.setIsRefreshing).toHaveBeenCalledWith(false);
    });
  });

  describe("ConversationThreadPanel", () => {
    it("renders the loading state during SSR", () => {
      const markup = renderToStaticMarkup(
        <ConversationThreadPanel conversationId="conv-ssr" />,
      );

      expect(markup).toContain("Conversation Thread");
      expect(markup).toContain("Loading thread from the operator message route.");
    });
  });
});
