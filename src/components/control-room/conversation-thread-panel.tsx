"use client";

import {
  DEGRADED_RELEASE_VERIFICATION_FRESHNESS,
  DEGRADED_RELEASE_VERIFICATION_STATUS,
  useOptionalControlRoomState,
} from "@/components/control-room/control-room-state";
import {
  DEFAULT_CHAT_CONTROL_ROOM_STATE,
  type BrowserCaptureEvidenceState,
  type ExceptionSummaryState,
  type MonitoringExportStatusSource,
  type ReleaseVerificationState,
  UNAVAILABLE_BROWSER_CAPTURE_EVIDENCE_STATE,
  UNAVAILABLE_EXCEPTION_SUMMARY_STATE,
  UNAVAILABLE_MONITORING_EXPORT_STATUS_SOURCE,
  UNAVAILABLE_RELEASE_VERIFICATION_STATE,
} from "@/lib/chat/control-room-state";
import type { SyncPanelState } from "@/lib/chat/evidence-sync-state";
import { useCallback, useEffect, useState } from "react";

type ConversationThreadSuccessPayload = {
  surface: "operator-control-room";
  conversationId: string;
  messages: Array<{
    id: string;
    role: string;
    text: string;
  }>;
  controlRoomState?: {
    nextRecommendedAction: string;
    missingEvidence: string;
    browserCapture: BrowserCaptureEvidenceState;
    monitoringExportStatus: MonitoringExportStatusSource;
    exceptionSummary: ExceptionSummaryState;
    releaseVerification?: ReleaseVerificationState;
  };
  syncPanelState?: SyncPanelState;
};

type ConversationThreadFailurePayload = {
  surface: "operator-control-room";
  conversationId: string;
  error: string;
};

export type ConversationThreadPanelState =
  | { kind: "loading" }
  | { kind: "success"; payload: ConversationThreadSuccessPayload }
  | { kind: "failure"; payload: ConversationThreadFailurePayload };

type FetchLike = typeof fetch;

export async function loadConversationThreadState(
  conversationId: string,
  fetchImpl: FetchLike = fetch,
): Promise<ConversationThreadPanelState> {
  const response = await fetchImpl(`/api/conversations/${conversationId}/messages`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as
    | ConversationThreadSuccessPayload
    | ConversationThreadFailurePayload;

  if (response.ok && "messages" in payload) {
    return {
      kind: "success",
      payload,
    };
  }

  return {
    kind: "failure",
    payload:
      "error" in payload
        ? payload
        : {
            surface: "operator-control-room",
            conversationId,
            error: "Conversation thread unavailable",
          },
  };
}

export function ConversationThreadPanelView({
  state,
  isRefreshing,
  onReload,
}: {
  state: ConversationThreadPanelState;
  isRefreshing: boolean;
  onReload: () => void;
}) {
  if (state.kind === "loading") {
    return (
      <div
        className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-5"
        data-testid="conversation-thread-panel"
      >
        <p className="text-sm font-medium text-white">Conversation Thread</p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Loading thread from the operator message route.
        </p>
      </div>
    );
  }

  if (state.kind === "failure") {
    return (
      <div
        className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5"
        data-testid="conversation-thread-panel"
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-white">Conversation Thread</p>
          <button
            className="rounded-full border border-amber-200/30 bg-amber-50/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-50"
            onClick={onReload}
            type="button"
          >
            {isRefreshing ? "Reloading thread" : "Reload thread"}
          </button>
        </div>
        <p className="mt-3 text-sm leading-7 text-amber-50">
          {state.payload.error}
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-5"
      data-testid="conversation-thread-panel"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-white">Conversation Thread</p>
        <button
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300"
          onClick={onReload}
          type="button"
        >
          {isRefreshing ? "Reloading thread" : "Reload thread"}
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {state.payload.messages.map((message) => (
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
      </div>
    </div>
  );
}

export type RefreshConversationThreadSetters = {
  setState: (state: ConversationThreadPanelState) => void;
  setIsRefreshing: (value: boolean) => void;
  setNextRecommendedAction?: (value: string) => void;
  setMissingEvidence?: (value: string) => void;
  setBrowserCapture?: (value: BrowserCaptureEvidenceState) => void;
  setMonitoringExportStatus?: (value: MonitoringExportStatusSource) => void;
  setExceptionSummary?: (value: ExceptionSummaryState) => void;
  setReleaseVerificationStatus?: (value: string) => void;
  setReleaseVerificationFreshness?: (value: string) => void;
  setSyncPanelState?: (value: SyncPanelState) => void;
};

export async function refreshConversationThread(
  conversationId: string,
  setters: RefreshConversationThreadSetters,
  fetchImpl?: FetchLike,
) {
  setters.setIsRefreshing(true);
  try {
    const nextState = await loadConversationThreadState(conversationId, fetchImpl);
    if (nextState.kind === "success") {
      const derivedControlRoomState = nextState.payload.controlRoomState;

      if (derivedControlRoomState) {
        setters.setNextRecommendedAction?.(derivedControlRoomState.nextRecommendedAction);
        setters.setMissingEvidence?.(derivedControlRoomState.missingEvidence);
        setters.setBrowserCapture?.(derivedControlRoomState.browserCapture);
        setters.setMonitoringExportStatus?.(
          derivedControlRoomState.monitoringExportStatus,
        );
        setters.setExceptionSummary?.(derivedControlRoomState.exceptionSummary);
        setters.setReleaseVerificationStatus?.(
          derivedControlRoomState.releaseVerification?.status ??
            DEGRADED_RELEASE_VERIFICATION_STATUS,
        );
        setters.setReleaseVerificationFreshness?.(
          derivedControlRoomState.releaseVerification?.freshness ??
            DEGRADED_RELEASE_VERIFICATION_FRESHNESS,
        );
        if (nextState.payload.syncPanelState) {
          setters.setSyncPanelState?.(nextState.payload.syncPanelState);
        }
      } else {
        setters.setBrowserCapture?.(UNAVAILABLE_BROWSER_CAPTURE_EVIDENCE_STATE);
        setters.setReleaseVerificationStatus?.(
          UNAVAILABLE_RELEASE_VERIFICATION_STATE.status,
        );
        setters.setReleaseVerificationFreshness?.(
          UNAVAILABLE_RELEASE_VERIFICATION_STATE.freshness,
        );
        setters.setNextRecommendedAction?.(
          DEFAULT_CHAT_CONTROL_ROOM_STATE.nextRecommendedAction,
        );
        setters.setMissingEvidence?.(DEFAULT_CHAT_CONTROL_ROOM_STATE.missingEvidence);
        setters.setMonitoringExportStatus?.(UNAVAILABLE_MONITORING_EXPORT_STATUS_SOURCE);
        setters.setExceptionSummary?.(UNAVAILABLE_EXCEPTION_SUMMARY_STATE);
      }
    }
    setters.setState(nextState);
  } finally {
    setters.setIsRefreshing(false);
  }
}

export function ConversationThreadPanel({
  conversationId,
}: {
  conversationId: string;
}) {
  const controlRoomState = useOptionalControlRoomState();
  const setNextRecommendedAction = controlRoomState?.setNextRecommendedAction;
  const setMissingEvidence = controlRoomState?.setMissingEvidence;
  const setBrowserCapture = controlRoomState?.setBrowserCapture;
  const setMonitoringExportStatus = controlRoomState?.setMonitoringExportStatus;
  const setExceptionSummary = controlRoomState?.setExceptionSummary;
  const setReleaseVerificationStatus =
    controlRoomState?.setReleaseVerificationStatus;
  const setReleaseVerificationFreshness =
    controlRoomState?.setReleaseVerificationFreshness;
  const setSyncPanelState = controlRoomState?.setSyncPanelState;
  const [state, setState] = useState<ConversationThreadPanelState>({
    kind: "loading",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshThread = useCallback(
    /* v8 ignore start */
    () =>
      refreshConversationThread(conversationId, {
        setState,
        setIsRefreshing,
        setNextRecommendedAction,
        setMissingEvidence,
        setBrowserCapture,
        setMonitoringExportStatus,
        setExceptionSummary,
        setReleaseVerificationStatus,
        setReleaseVerificationFreshness,
        setSyncPanelState,
      }),
    /* v8 ignore stop */
    [
      conversationId,
      setBrowserCapture,
      setExceptionSummary,
      setMissingEvidence,
      setMonitoringExportStatus,
      setNextRecommendedAction,
      setReleaseVerificationFreshness,
      setReleaseVerificationStatus,
      setSyncPanelState,
    ],
  );

  /* v8 ignore start */
  useEffect(() => {
    void refreshThread();
  }, [refreshThread]);
  /* v8 ignore stop */

  return (
    <ConversationThreadPanelView
      isRefreshing={isRefreshing}
      /* v8 ignore start */
      onReload={() => {
        void refreshThread();
      }}
      /* v8 ignore stop */
      state={state}
    />
  );
}
