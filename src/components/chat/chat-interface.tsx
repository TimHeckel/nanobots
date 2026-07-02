"use client";

import { useOptionalControlRoomState } from "@/components/control-room/control-room-state";
import { useState } from "react";
import {
  DEGRADED_RELEASE_VERIFICATION_FRESHNESS,
  DEGRADED_RELEASE_VERIFICATION_STATUS,
} from "@/components/control-room/control-room-state";
import type { SyncPanelState } from "@/lib/chat/evidence-sync-state";
import type {
  BrowserCaptureEvidenceState,
  ControlMappingState,
  ExceptionSummaryState,
  MonitoringExportStatusSource,
  ReleaseVerificationState,
} from "@/lib/chat/control-room-state";

const CHAT_ROUTE_FALLBACK_ERROR =
  "Control-room response unavailable. Retry the operator request.";

export type ChatRouteSuccessPayload = {
  surface: "operator-control-room";
  conversationId: string;
  message: {
    id: string;
    role: string;
    text: string;
  };
  controlRoomState: {
    nextRecommendedAction: string;
    missingEvidence: string;
    browserCapture: BrowserCaptureEvidenceState;
    monitoringExportStatus: MonitoringExportStatusSource;
    cc81ControlMapping: ControlMappingState;
    exceptionSummary: ExceptionSummaryState;
    releaseVerification?: ReleaseVerificationState;
  };
  syncPanelState?: SyncPanelState;
};

export type ChatRouteFailurePayload = {
  surface: "operator-control-room";
  conversationId: string;
  error: string;
};

export type ChatMessage = {
  id: string;
  role: "operator" | "assistant";
  text: string;
};

interface ChatInterfaceProps {
  user: {
    id: string;
    name: string | null;
    login: string;
    avatarUrl: string | null;
  };
  org: {
    id: string;
    name: string | null;
    login: string;
    avatarUrl: string | null;
  };
  isPlatformAdmin?: boolean;
  conversationId?: string;
}

export function isChatRouteSuccessPayload(
  payload: ChatRouteSuccessPayload | ChatRouteFailurePayload,
): payload is ChatRouteSuccessPayload {
  return "message" in payload;
}

export type ControlRoomStateSetters = {
  setNextRecommendedAction?: (value: string) => void;
  setMissingEvidence?: (value: string) => void;
  setBrowserCapture?: (value: BrowserCaptureEvidenceState) => void;
  setMonitoringExportStatus?: (value: MonitoringExportStatusSource) => void;
  setCc81ControlMapping?: (value: ControlMappingState) => void;
  setExceptionSummary?: (value: ExceptionSummaryState) => void;
  setReleaseVerificationStatus?: (value: string) => void;
  setReleaseVerificationFreshness?: (value: string) => void;
  setSyncPanelState?: (value: SyncPanelState) => void;
};

export async function submitOperatorMessage(
  message: string,
  conversationId: string,
  controlRoomState: ControlRoomStateSetters | null,
  setMessages: (fn: (prev: ChatMessage[]) => ChatMessage[]) => void,
  setError: (error: string | null) => void,
  setIsSending: (value: boolean) => void,
  fetchImpl: typeof fetch = fetch,
) {
  setMessages((previousMessages) => [
    ...previousMessages,
    {
      id: `operator-${previousMessages.length + 1}`,
      role: "operator",
      text: message,
    },
  ]);
  setError(null);
  setIsSending(true);

  try {
    const response = await fetchImpl("/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        text: message,
      }),
    });
    const payload = (await response.json()) as
      | ChatRouteSuccessPayload
      | ChatRouteFailurePayload;

    if (response.ok && isChatRouteSuccessPayload(payload)) {
      controlRoomState?.setNextRecommendedAction?.(
        payload.controlRoomState.nextRecommendedAction,
      );
      controlRoomState?.setMissingEvidence?.(
        payload.controlRoomState.missingEvidence,
      );
      controlRoomState?.setBrowserCapture?.(payload.controlRoomState.browserCapture);
      controlRoomState?.setMonitoringExportStatus?.(
        payload.controlRoomState.monitoringExportStatus,
      );
      controlRoomState?.setCc81ControlMapping?.(
        payload.controlRoomState.cc81ControlMapping,
      );
      controlRoomState?.setExceptionSummary?.(
        payload.controlRoomState.exceptionSummary,
      );
      controlRoomState?.setReleaseVerificationStatus?.(
        payload.controlRoomState.releaseVerification?.status ??
          DEGRADED_RELEASE_VERIFICATION_STATUS,
      );
      controlRoomState?.setReleaseVerificationFreshness?.(
        payload.controlRoomState.releaseVerification?.freshness ??
          DEGRADED_RELEASE_VERIFICATION_FRESHNESS,
      );
      if (payload.syncPanelState) {
        controlRoomState?.setSyncPanelState?.(payload.syncPanelState);
      }
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: `assistant-${previousMessages.length + 1}`,
          role: "assistant",
          text: payload.message.text,
        },
      ]);
      return;
    }

    setError("error" in payload ? payload.error : CHAT_ROUTE_FALLBACK_ERROR);
  } catch {
    setError(CHAT_ROUTE_FALLBACK_ERROR);
  } finally {
    setIsSending(false);
  }
}

export function handleChatSend(
  draft: string,
  isSending: boolean,
  setDraft: (value: string) => void,
  submitFn: (message: string) => void,
  messageOverride?: string,
) {
  const message = (messageOverride ?? draft).trim();

  if (!message || isSending) {
    return;
  }

  setDraft("");
  submitFn(message);
}

export function handleTextareaChange(
  onDraftChange: (value: string) => void,
  event: React.ChangeEvent<HTMLTextAreaElement>,
) {
  onDraftChange(event.target.value);
}

export function handleTextareaKeyDown(
  onSend: (messageOverride?: string) => void,
  event: React.KeyboardEvent<HTMLTextAreaElement>,
) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    onSend(event.currentTarget.value);
  }
}

export function handleSendClick(onSend: (messageOverride?: string) => void) {
  onSend();
}

export function buildChatSendHandler(
  draft: string,
  isSending: boolean,
  setDraft: (value: string) => void,
  resolvedConversationId: string,
  controlRoomState: ControlRoomStateSetters | null,
  setMessages: (fn: (prev: ChatMessage[]) => ChatMessage[]) => void,
  setError: (error: string | null) => void,
  setIsSending: (value: boolean) => void,
  override?: string,
) {
  handleChatSend(draft, isSending, setDraft, (msg) => {
    void submitOperatorMessage(
      msg,
      resolvedConversationId,
      controlRoomState,
      setMessages,
      setError,
      setIsSending,
    );
  }, override);
}

export type ChatInterfaceViewProps = {
  user: ChatInterfaceProps["user"];
  org: ChatInterfaceProps["org"];
  resolvedConversationId: string;
  messages: ChatMessage[];
  isSending: boolean;
  error: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (messageOverride?: string) => void;
};

export function ChatInterfaceView({
  user,
  org,
  resolvedConversationId,
  messages,
  isSending,
  error,
  draft,
  onDraftChange,
  onSend,
}: ChatInterfaceViewProps) {
  
  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">
        Conversation Panel
      </p>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-white">
            Operator Control Room
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Live turn surface for {user.login} in {org.login}. Conversation ID:{" "}
            {resolvedConversationId}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
          Live route
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4">
            <p className="text-sm leading-6 text-slate-300">
              No operator updates submitted yet.
            </p>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">
              {message.role}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {message.text}
            </p>
          </div>
        ))}

        {isSending ? (
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4">
            <p className="text-sm leading-6 text-cyan-100">
              Sending operator update through the control-room route.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-100">
              Chat route failure
            </p>
            <p className="mt-3 text-sm leading-6 text-amber-50">{error}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <label
          className="text-xs uppercase tracking-[0.2em] text-cyan-300/70"
          htmlFor="control-room-chat-input"
        >
          Operator prompt
        </label>
        <textarea
          id="control-room-chat-input"
          className="mt-3 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition focus:border-cyan-400/60"
          disabled={isSending}
          onChange={handleTextareaChange.bind(null, onDraftChange)}
          onKeyDown={handleTextareaKeyDown.bind(null, onSend)}
          placeholder="Ask nanobots anything..."
          value={draft}
        />
        <div className="mt-3 flex justify-end">
          <button
            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSending || draft.trim().length === 0}
            onClick={handleSendClick.bind(null, onSend)}
            type="button"
          >
            Send turn
          </button>
        </div>
      </div>
    </section>
  );
}

export function ChatInterface({
  user,
  org,
  conversationId,
}: ChatInterfaceProps) {
  const controlRoomState = useOptionalControlRoomState();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const resolvedConversationId = conversationId ?? "new";

  

  return (
    <ChatInterfaceView
      user={user}
      org={org}
      resolvedConversationId={resolvedConversationId}
      messages={messages}
      isSending={isSending}
      error={error}
      draft={draft}
      onDraftChange={setDraft}
      onSend={buildChatSendHandler.bind(null, draft, isSending, setDraft, resolvedConversationId, controlRoomState, setMessages, setError, setIsSending)}
    />
  );
}
