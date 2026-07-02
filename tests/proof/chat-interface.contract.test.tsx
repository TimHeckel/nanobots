import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ChatInterface,
  ChatInterfaceView,
  buildChatSendHandler,
  handleChatSend,
  handleSendClick,
  handleTextareaChange,
  handleTextareaKeyDown,
  isChatRouteSuccessPayload,
  submitOperatorMessage,
} from "@/components/chat/chat-interface";
import type {
  ChatMessage,
  ChatRouteFailurePayload,
  ChatRouteSuccessPayload,
  ControlRoomStateSetters,
} from "@/components/chat/chat-interface";
import {
  DEGRADED_RELEASE_VERIFICATION_FRESHNESS,
  DEGRADED_RELEASE_VERIFICATION_STATUS,
} from "@/components/control-room/control-room-state";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

describe("chat interface contract", () => {
  describe("isChatRouteSuccessPayload", () => {
    it("returns true when the payload contains a message field", () => {
      const payload: ChatRouteSuccessPayload = {
        surface: "operator-control-room",
        conversationId: "conv-1",
        message: { id: "m1", role: "assistant", text: "hello" },
        controlRoomState: {
          nextRecommendedAction: "action",
          missingEvidence: "evidence",
          browserCapture: { status: "Standby", detail: "detail" },
          monitoringExportStatus: { phase: "preview", controlId: null },
          cc81ControlMapping: { note: "note" },
          exceptionSummary: { items: [] },
        },
      };

      expect(isChatRouteSuccessPayload(payload)).toBe(true);
    });

    it("returns false when the payload contains an error field", () => {
      const payload: ChatRouteFailurePayload = {
        surface: "operator-control-room",
        conversationId: "conv-1",
        error: "Something went wrong",
      };

      expect(isChatRouteSuccessPayload(payload)).toBe(false);
    });
  });

  describe("submitOperatorMessage", () => {
    function buildControlRoomSetters(): ControlRoomStateSetters {
      return {
        setNextRecommendedAction: vi.fn(),
        setMissingEvidence: vi.fn(),
        setBrowserCapture: vi.fn(),
        setMonitoringExportStatus: vi.fn(),
        setCc81ControlMapping: vi.fn(),
        setExceptionSummary: vi.fn(),
        setReleaseVerificationStatus: vi.fn(),
        setReleaseVerificationFreshness: vi.fn(),
        setSyncPanelState: vi.fn(),
      };
    }

    it("appends operator message, sends to chat route, and pushes assistant reply on success", async () => {
      const setMessages = vi.fn(function(fn) { if (typeof fn === "function") return fn([]); return fn; });
      const setError = vi.fn();
      const setIsSending = vi.fn();
      const controlRoom = buildControlRoomSetters();
      const fetchImpl = mockFetch(200, {
        surface: "operator-control-room",
        conversationId: "conv-1",
        message: { id: "a1", role: "assistant", text: "Got it." },
        controlRoomState: {
          nextRecommendedAction: "Attach screenshot",
          missingEvidence: "Missing screenshot",
          browserCapture: { status: "Queued", detail: "queued" },
          monitoringExportStatus: { phase: "evidence-refresh-queued", controlId: "CC8.1" },
          cc81ControlMapping: { note: "mapping" },
          exceptionSummary: { items: ["item"] },
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
      } satisfies ChatRouteSuccessPayload);

      await submitOperatorMessage(
        "hello",
        "conv-1",
        controlRoom,
        setMessages,
        setError,
        setIsSending,
        fetchImpl,
      );

      expect(setMessages).toHaveBeenCalledTimes(2);
      expect(setError).toHaveBeenCalledWith(null);
      expect(setIsSending).toHaveBeenCalledWith(true);
      expect(setIsSending).toHaveBeenCalledWith(false);

      expect(controlRoom.setNextRecommendedAction).toHaveBeenCalledWith("Attach screenshot");
      expect(controlRoom.setMissingEvidence).toHaveBeenCalledWith("Missing screenshot");
      expect(controlRoom.setBrowserCapture).toHaveBeenCalledWith({ status: "Queued", detail: "queued" });
      expect(controlRoom.setMonitoringExportStatus).toHaveBeenCalledWith({
        phase: "evidence-refresh-queued",
        controlId: "CC8.1",
      });
      expect(controlRoom.setCc81ControlMapping).toHaveBeenCalledWith({ note: "mapping" });
      expect(controlRoom.setExceptionSummary).toHaveBeenCalledWith({ items: ["item"] });
      expect(controlRoom.setReleaseVerificationStatus).toHaveBeenCalledWith("Capture queued");
      expect(controlRoom.setReleaseVerificationFreshness).toHaveBeenCalledWith("queued freshness");
      expect(controlRoom.setSyncPanelState).toHaveBeenCalledWith(
        expect.objectContaining({
          syncHealth: expect.objectContaining({
            value: "Attention required",
          }),
        }),
      );

      expect(fetchImpl).toHaveBeenCalledWith("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "conv-1", text: "hello" }),
      });
    });

    it("uses degraded release verification defaults when releaseVerification is missing", async () => {
      const setMessages = vi.fn(function(fn) { if (typeof fn === "function") return fn([]); return fn; });
      const setError = vi.fn();
      const setIsSending = vi.fn();
      const controlRoom = buildControlRoomSetters();
      const fetchImpl = mockFetch(200, {
        surface: "operator-control-room",
        conversationId: "conv-1",
        message: { id: "a1", role: "assistant", text: "Ok" },
        controlRoomState: {
          nextRecommendedAction: "action",
          missingEvidence: "evidence",
          browserCapture: { status: "Standby", detail: "detail" },
          monitoringExportStatus: { phase: "preview", controlId: null },
          cc81ControlMapping: { note: "note" },
          exceptionSummary: { items: [] },
        },
      });

      await submitOperatorMessage("test", "conv-1", controlRoom, setMessages, setError, setIsSending, fetchImpl);

      expect(controlRoom.setReleaseVerificationStatus).toHaveBeenCalledWith(
        DEGRADED_RELEASE_VERIFICATION_STATUS,
      );
      expect(controlRoom.setReleaseVerificationFreshness).toHaveBeenCalledWith(
        DEGRADED_RELEASE_VERIFICATION_FRESHNESS,
      );
    });

    it("does not try to update sync panel state when the route omits it", async () => {
      const setMessages = vi.fn(function(fn) { if (typeof fn === "function") return fn([]); return fn; });
      const setError = vi.fn();
      const setIsSending = vi.fn();
      const controlRoom = buildControlRoomSetters();
      const fetchImpl = mockFetch(200, {
        surface: "operator-control-room",
        conversationId: "conv-1",
        message: { id: "a1", role: "assistant", text: "Ok" },
        controlRoomState: {
          nextRecommendedAction: "action",
          missingEvidence: "evidence",
          browserCapture: { status: "Standby", detail: "detail" },
          monitoringExportStatus: { phase: "preview", controlId: null },
          cc81ControlMapping: { note: "note" },
          exceptionSummary: { items: [] },
        },
      });

      await submitOperatorMessage("test", "conv-1", controlRoom, setMessages, setError, setIsSending, fetchImpl);

      expect(controlRoom.setSyncPanelState).not.toHaveBeenCalled();
    });

    it("sets error from payload error field on failure response", async () => {
      const setMessages = vi.fn(function(fn) { if (typeof fn === "function") return fn([]); return fn; });
      const setError = vi.fn();
      const setIsSending = vi.fn();
      const fetchImpl = mockFetch(500, {
        surface: "operator-control-room",
        conversationId: "conv-1",
        error: "Server error",
      } satisfies ChatRouteFailurePayload);

      await submitOperatorMessage("test", "conv-1", null, setMessages, setError, setIsSending, fetchImpl);

      expect(setError).toHaveBeenCalledWith("Server error");
      expect(setIsSending).toHaveBeenCalledWith(false);
    });

    it("sets fallback error when failure payload lacks error field", async () => {
      const setMessages = vi.fn(function(fn) { if (typeof fn === "function") return fn([]); return fn; });
      const setError = vi.fn();
      const setIsSending = vi.fn();
      const fetchImpl = mockFetch(500, {
        surface: "operator-control-room",
        conversationId: "conv-1",
      });

      await submitOperatorMessage("test", "conv-1", null, setMessages, setError, setIsSending, fetchImpl);

      expect(setError).toHaveBeenCalledWith(
        "Control-room response unavailable. Retry the operator request.",
      );
    });

    it("sets fallback error on network failure", async () => {
      const setMessages = vi.fn(function(fn) { if (typeof fn === "function") return fn([]); return fn; });
      const setError = vi.fn();
      const setIsSending = vi.fn();
      const fetchImpl = vi.fn(async () => {
        throw new Error("Network error");
      }) as unknown as typeof fetch;

      await submitOperatorMessage("test", "conv-1", null, setMessages, setError, setIsSending, fetchImpl);

      expect(setError).toHaveBeenCalledWith(
        "Control-room response unavailable. Retry the operator request.",
      );
      expect(setIsSending).toHaveBeenCalledWith(false);
    });

    it("works with null controlRoomState without throwing", async () => {
      const setMessages = vi.fn(function(fn) { if (typeof fn === "function") return fn([]); return fn; });
      const setError = vi.fn();
      const setIsSending = vi.fn();
      const fetchImpl = mockFetch(200, {
        surface: "operator-control-room",
        conversationId: "conv-1",
        message: { id: "a1", role: "assistant", text: "ok" },
        controlRoomState: {
          nextRecommendedAction: "action",
          missingEvidence: "evidence",
          browserCapture: { status: "Standby", detail: "detail" },
          monitoringExportStatus: { phase: "preview", controlId: null },
          cc81ControlMapping: { note: "note" },
          exceptionSummary: { items: [] },
        },
      });

      await submitOperatorMessage("test", "conv-1", null, setMessages, setError, setIsSending, fetchImpl);

      expect(setMessages).toHaveBeenCalledTimes(2);
    });
  });

  describe("handleChatSend", () => {
    it("does nothing when the draft is empty", () => {
      const setDraft = vi.fn();
      const submitFn = vi.fn();

      handleChatSend("", false, setDraft, submitFn);

      expect(setDraft).not.toHaveBeenCalled();
      expect(submitFn).not.toHaveBeenCalled();
    });

    it("does nothing when the draft is whitespace only", () => {
      const setDraft = vi.fn();
      const submitFn = vi.fn();

      handleChatSend("   ", false, setDraft, submitFn);

      expect(submitFn).not.toHaveBeenCalled();
    });

    it("does nothing when isSending is true", () => {
      const setDraft = vi.fn();
      const submitFn = vi.fn();

      handleChatSend("hello", true, setDraft, submitFn);

      expect(submitFn).not.toHaveBeenCalled();
    });

    it("clears the draft and submits the trimmed message", () => {
      const setDraft = vi.fn();
      const submitFn = vi.fn();

      handleChatSend("  hello world  ", false, setDraft, submitFn);

      expect(setDraft).toHaveBeenCalledWith("");
      expect(submitFn).toHaveBeenCalledWith("hello world");
    });

    it("uses messageOverride instead of draft when provided", () => {
      const setDraft = vi.fn();
      const submitFn = vi.fn();

      handleChatSend("draft text", false, setDraft, submitFn, "override text");

      expect(setDraft).toHaveBeenCalledWith("");
      expect(submitFn).toHaveBeenCalledWith("override text");
    });

    it("does nothing when messageOverride is empty", () => {
      const setDraft = vi.fn();
      const submitFn = vi.fn();

      handleChatSend("draft", false, setDraft, submitFn, "   ");

      expect(submitFn).not.toHaveBeenCalled();
    });
  });

  describe("ChatInterfaceView", () => {
    const baseProps = {
      user: { id: "u1", name: "Op", login: "operator", avatarUrl: null },
      org: { id: "o1", name: "Acme", login: "acme", avatarUrl: null },
      resolvedConversationId: "conv-view",
      messages: [] as ChatMessage[],
      isSending: false,
      error: null,
      draft: "",
      onDraftChange: () => {},
      onSend: () => {},
    };

    it("renders the empty messages state", () => {
      const markup = renderToStaticMarkup(<ChatInterfaceView {...baseProps} />);

      expect(markup).toContain("No operator updates submitted yet.");
      expect(markup).toContain("conv-view");
      expect(markup).toContain("operator");
      expect(markup).toContain("acme");
    });

    it("renders messages when present", () => {
      const markup = renderToStaticMarkup(
        <ChatInterfaceView
          {...baseProps}
          messages={[
            { id: "m1", role: "operator", text: "What is the status?" },
            { id: "m2", role: "assistant", text: "All clear." },
          ]}
        />,
      );

      expect(markup).toContain("What is the status?");
      expect(markup).toContain("All clear.");
      expect(markup).not.toContain("No operator updates submitted yet.");
    });

    it("renders the sending indicator when isSending is true", () => {
      const markup = renderToStaticMarkup(
        <ChatInterfaceView {...baseProps} isSending={true} />,
      );

      expect(markup).toContain("Sending operator update through the control-room route.");
    });

    it("renders the error state", () => {
      const markup = renderToStaticMarkup(
        <ChatInterfaceView {...baseProps} error="Chat route failure happened" />,
      );

      expect(markup).toContain("Chat route failure");
      expect(markup).toContain("Chat route failure happened");
    });

    it("renders the draft value in the textarea", () => {
      const markup = renderToStaticMarkup(
        <ChatInterfaceView {...baseProps} draft="partial message" />,
      );

      expect(markup).toContain("partial message");
    });
  });

  describe("ChatInterface", () => {
    it("renders the live control-room turn surface for an existing conversation", () => {
      const markup = renderToStaticMarkup(
        <ChatInterface
          user={{ id: "u1", name: "Operator", login: "operator", avatarUrl: null }}
          org={{ id: "o1", name: "Acme", login: "acme", avatarUrl: null }}
          conversationId="conv_1"
        />,
      );

      expect(markup).toContain("Conversation Panel");
      expect(markup).toContain("Operator Control Room");
      expect(markup).toContain("Live turn surface for operator in acme");
      expect(markup).toContain("conv_1");
    });

    it("falls back to the new conversation id when one is not provided", () => {
      const markup = renderToStaticMarkup(
        <ChatInterface
          user={{ id: "u1", name: "Operator", login: "operator", avatarUrl: null }}
          org={{ id: "o1", name: "Acme", login: "acme", avatarUrl: null }}
        />,
      );

      expect(markup).toContain("new");
    });
  });

  describe("handleTextareaChange", () => {
    it("calls onDraftChange with the input value", () => {
      const onDraftChange = vi.fn();
      const event = { target: { value: "new text" } } as React.ChangeEvent<HTMLTextAreaElement>;
      handleTextareaChange(onDraftChange, event);
      expect(onDraftChange).toHaveBeenCalledWith("new text");
    });
  });

  describe("handleTextareaKeyDown", () => {
    it("calls onSend when Enter is pressed without shift", () => {
      const onSend = vi.fn();
      const event = {
        key: "Enter",
        shiftKey: false,
        preventDefault: vi.fn(),
        currentTarget: { value: "send this" },
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
      handleTextareaKeyDown(onSend, event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(onSend).toHaveBeenCalledWith("send this");
    });

    it("does nothing when Shift+Enter is pressed", () => {
      const onSend = vi.fn();
      const event = {
        key: "Enter",
        shiftKey: true,
        preventDefault: vi.fn(),
        currentTarget: { value: "v" },
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
      handleTextareaKeyDown(onSend, event);
      expect(onSend).not.toHaveBeenCalled();
    });

    it("does nothing for non-Enter keys", () => {
      const onSend = vi.fn();
      const event = {
        key: "a",
        shiftKey: false,
        preventDefault: vi.fn(),
        currentTarget: { value: "v" },
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
      handleTextareaKeyDown(onSend, event);
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe("handleSendClick", () => {
    it("invokes onSend with no arguments", () => {
      const onSend = vi.fn();
      handleSendClick(onSend);
      expect(onSend).toHaveBeenCalled();
    });
  });

  describe("buildChatSendHandler", () => {
    it("delegates to handleChatSend and submitOperatorMessage", () => {
      const setDraft = vi.fn();
      const setMessages = vi.fn(function(fn) { if (typeof fn === "function") return fn([]); return fn; });
      const setError = vi.fn();
      const setIsSending = vi.fn();
      buildChatSendHandler(
        "my message",
        false,
        setDraft,
        "conv-build",
        null,
        setMessages,
        setError,
        setIsSending,
      );
      expect(setDraft).toHaveBeenCalledWith("");
    });

    it("does not submit when isSending is true", () => {
      const setDraft = vi.fn();
      const setMessages = vi.fn(function(fn) { if (typeof fn === "function") return fn([]); return fn; });
      const setError = vi.fn();
      const setIsSending = vi.fn();
      buildChatSendHandler(
        "msg",
        true,
        setDraft,
        "conv-build",
        null,
        setMessages,
        setError,
        setIsSending,
      );
      expect(setDraft).not.toHaveBeenCalled();
    });
  });
});
