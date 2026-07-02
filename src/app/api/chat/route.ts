import { NextResponse } from "next/server";
import {
  buildGapResolutionControlRoomState,
} from "@/lib/chat/control-room-state";
import { loadControlRoomExecutionSource } from "@/lib/chat/control-room-execution-source";
import { buildControlRoomStateFromControlGapState } from "@/lib/chat/control-gap-state";
import { loadConversationSyncPanelState } from "@/lib/chat/conversation-thread-store";
import {
  recordConversationControlGapState,
  recordConversationTurnMessages,
} from "@/lib/chat/conversation-thread-store";
import { connectEvidenceSourceToolDef } from "@/lib/chat/tools/connect-evidence-source";
import { inspectControlGapsToolDef } from "@/lib/chat/tools/inspect-control-gaps";
import { resolveControlGapToolDef } from "@/lib/chat/tools/resolve-control-gap";
import { syncEvidenceSourceToolDef } from "@/lib/chat/tools/sync-evidence-source";

type ChatTurnRequest = {
  conversationId?: unknown;
  text?: unknown;
};

const CHAT_ROUTE_FAILURE_SENTINEL = "force chat route failure";
const CHAT_ROUTE_FAILURE_MESSAGE =
  "Control-room response unavailable. Retry the operator request.";
const CHAT_ROUTE_MISSING_CONTROL_HEALTH_SENTINEL =
  "force missing control health delta";

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

type ParsedGapAction =
  | { kind: "inspect" }
  | {
      kind: "connect-source";
      sourceType: "github";
      repo: string;
    }
  | {
      kind: "sync-source";
      sourceType: "github";
      repo: string;
    }
  | {
      kind: "resolve";
      controlId: string;
      action:
        | "attach_evidence"
        | "manual_review"
        | "trigger_rescan"
        | "escalate";
      evidenceId?: string;
      note?: string;
    };

function parseGapAction(text: string): ParsedGapAction | null {
  const normalized = text.trim().toLowerCase();
  const connectMatch = text.match(/^\s*connect\s+github\s+([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\s*$/i);
  if (connectMatch) {
    return {
      kind: "connect-source",
      sourceType: "github",
      repo: connectMatch[1],
    };
  }

  const syncMatch = text.match(/^\s*sync\s+github\s+([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\s*$/i);
  if (syncMatch) {
    return {
      kind: "sync-source",
      sourceType: "github",
      repo: syncMatch[1],
    };
  }

  if (
    normalized === "show control gaps" ||
    normalized === "inspect control gaps" ||
    normalized === "what evidence is missing?"
  ) {
    return { kind: "inspect" };
  }

  const controlMatch = text.match(/\b(CC\d+\.\d+)\b/i);
  const controlId = controlMatch?.[1]?.toUpperCase();

  if (!controlId) {
    return null;
  }

  if (/^\s*attach\b/i.test(text) && /evidence|screenshot/i.test(text)) {
    return {
      kind: "resolve",
      controlId,
      action: "attach_evidence",
      evidenceId: "release-approval-screenshot",
      note: text,
    };
  }

  if (/^\s*(mark|manual(?:ly)?)\b/i.test(text) && /review/i.test(text)) {
    return {
      kind: "resolve",
      controlId,
      action: "manual_review",
      note: text,
    };
  }

  if (/^\s*(rerun|re-?scan|refresh)\b/i.test(text)) {
    return {
      kind: "resolve",
      controlId,
      action: "trigger_rescan",
      note: text,
    };
  }

  if (/^\s*escalate\b/i.test(text)) {
    return {
      kind: "resolve",
      controlId,
      action: "escalate",
      note: text,
    };
  }

  return null;
}

export async function POST(request: Request) {
  let payload: ChatTurnRequest;

  try {
    payload = (await request.json()) as ChatTurnRequest;
  } catch {
    return NextResponse.json(
      {
        surface: "operator-control-room",
        conversationId: null,
        error: "Conversation route unavailable",
      },
      { status: 400 },
    );
  }

  const conversationId = normalizeString(payload.conversationId) ?? "new";
  const text = normalizeString(payload.text);

  if (!text) {
    return NextResponse.json(
      {
        surface: "operator-control-room",
        conversationId,
        error: "Operator message is required",
      },
      { status: 400 },
    );
  }

  if (text === CHAT_ROUTE_FAILURE_SENTINEL) {
    return NextResponse.json(
      {
        surface: "operator-control-room",
        conversationId,
        error: CHAT_ROUTE_FAILURE_MESSAGE,
      },
      { status: 503 },
    );
  }

  const omitControlHealthDelta =
    text === CHAT_ROUTE_MISSING_CONTROL_HEALTH_SENTINEL;
  const parsedGapAction = parseGapAction(text);

  if (parsedGapAction?.kind === "connect-source") {
    const toolResult = await connectEvidenceSourceToolDef(conversationId).execute({
      sourceType: parsedGapAction.sourceType,
      repo: parsedGapAction.repo,
    });

    recordConversationControlGapState({
      conversationId,
      controlGapState: toolResult.controlGapState,
      syncPanelState: toolResult.syncPanelState,
    });

    recordConversationTurnMessages({
      conversationId,
      operatorText: text,
      assistantText: toolResult.message,
      controlRoomState: buildControlRoomStateFromControlGapState(
        toolResult.controlGapState,
      ),
      exceptionExportSource: {
        browserCapturePhase: "standby",
        releaseVerificationPhase: "at-risk",
      },
      monitoringExportStatusSource: {
        phase: "preview",
        controlId: "CC8.1",
      },
      controlGapState: toolResult.controlGapState,
      syncPanelState: toolResult.syncPanelState,
    });

    return NextResponse.json({
      surface: "operator-control-room",
      conversationId,
      message: {
        id: `assistant-${conversationId}`,
        role: "assistant",
        text: toolResult.message,
      },
      controlRoomState: buildControlRoomStateFromControlGapState(
        toolResult.controlGapState,
      ),
      syncPanelState: toolResult.syncPanelState,
    });
  }

  if (parsedGapAction?.kind === "sync-source") {
    const sourceId = `${parsedGapAction.sourceType}:${parsedGapAction.repo.toLowerCase()}`;
    const toolResult = await syncEvidenceSourceToolDef(conversationId).execute({
      sourceId,
    });

    recordConversationControlGapState({
      conversationId,
      controlGapState: toolResult.controlGapState,
      syncPanelState: toolResult.syncPanelState,
    });

    recordConversationTurnMessages({
      conversationId,
      operatorText: text,
      assistantText: toolResult.message,
      controlRoomState: buildControlRoomStateFromControlGapState(
        toolResult.controlGapState,
      ),
      exceptionExportSource: {
        browserCapturePhase: "standby",
        releaseVerificationPhase: "at-risk",
      },
      monitoringExportStatusSource: {
        phase: "preview",
        controlId: "CC8.1",
      },
      controlGapState: toolResult.controlGapState,
      syncPanelState: toolResult.syncPanelState,
    });

    return NextResponse.json({
      surface: "operator-control-room",
      conversationId,
      message: {
        id: `assistant-${conversationId}`,
        role: "assistant",
        text: toolResult.message,
      },
      controlRoomState: buildControlRoomStateFromControlGapState(
        toolResult.controlGapState,
      ),
      syncPanelState: toolResult.syncPanelState,
    });
  }

  if (parsedGapAction?.kind === "inspect") {
    const toolResult = await inspectControlGapsToolDef(conversationId).execute({
      includeHealthy: false,
    });
    const syncPanelState = await loadConversationSyncPanelState(conversationId);

    recordConversationControlGapState({
      conversationId,
      controlGapState: toolResult.state,
      syncPanelState: syncPanelState ?? undefined,
    });

    recordConversationTurnMessages({
      conversationId,
      operatorText: text,
      assistantText:
        toolResult.gaps.length > 0
          ? `Actionable gaps: ${toolResult.gaps.map((gap) => `${gap.controlId} (${gap.status})`).join(", ")}.`
          : "All tracked controls are currently healthy.",
      controlRoomState: toolResult.controlRoomState,
      exceptionExportSource:
        toolResult.executionSource.exceptionExportSource,
      monitoringExportStatusSource:
        toolResult.executionSource.monitoringExportStatusSource,
      controlGapState: toolResult.state,
      syncPanelState: syncPanelState ?? undefined,
    });

    const responsePayload = {
      surface: "operator-control-room",
      conversationId,
      message: {
        id: `assistant-${conversationId}`,
        role: "assistant",
        text:
          toolResult.gaps.length > 0
            ? `Actionable gaps: ${toolResult.gaps.map((gap) => `${gap.controlId} (${gap.status})`).join(", ")}.`
            : "All tracked controls are currently healthy.",
      },
      gaps: toolResult.gaps,
      controlRoomState: toolResult.controlRoomState,
      ...(syncPanelState ? { syncPanelState } : {}),
    };

    return NextResponse.json(responsePayload);
  }

  if (parsedGapAction?.kind === "resolve") {
    const toolResult = await resolveControlGapToolDef(conversationId).execute({
      controlId: parsedGapAction.controlId,
      action: parsedGapAction.action,
      evidenceId: parsedGapAction.evidenceId,
      note: parsedGapAction.note,
    });
    const syncPanelState = await loadConversationSyncPanelState(conversationId);

    recordConversationControlGapState({
      conversationId,
      controlGapState: toolResult.state,
      syncPanelState: syncPanelState ?? undefined,
    });

    recordConversationTurnMessages({
      conversationId,
      operatorText: text,
      assistantText: toolResult.message,
      controlRoomState: toolResult.controlRoomState,
      exceptionExportSource:
        toolResult.executionSource.exceptionExportSource,
      monitoringExportStatusSource:
        toolResult.executionSource.monitoringExportStatusSource,
      controlGapState: toolResult.state,
      syncPanelState: syncPanelState ?? undefined,
    });

    const responsePayload = {
      surface: "operator-control-room",
      conversationId,
      message: {
        id: `assistant-${conversationId}`,
        role: "assistant",
        text: toolResult.message,
      },
      mutatedControl: toolResult.mutatedControl,
      controlRoomState: toolResult.controlRoomState,
      ...(syncPanelState ? { syncPanelState } : {}),
    };

    return NextResponse.json(responsePayload);
  }

  const controlRoomExecutionSource = await loadControlRoomExecutionSource({
    conversationId,
    text,
  });
  const controlRoomState =
    buildGapResolutionControlRoomState(controlRoomExecutionSource);

  const assistantText =
    "Route-backed next action: capture the release approval screenshot and resync Sprinto.";

  recordConversationTurnMessages({
    conversationId,
    operatorText: text,
    assistantText,
    controlRoomState,
    exceptionExportSource:
      controlRoomExecutionSource.exceptionExportSource,
    monitoringExportStatusSource:
      controlRoomExecutionSource.monitoringExportStatusSource,
  });
  const syncPanelState = await loadConversationSyncPanelState(conversationId);
  const responsePayload = {
    surface: "operator-control-room",
    conversationId,
    message: {
      id: `assistant-${conversationId}`,
      role: "assistant",
      text: assistantText,
    },
    controlRoomState: {
      ...controlRoomState,
      ...(omitControlHealthDelta
        ? {
            releaseVerification: undefined,
          }
        : {}),
    },
    ...(syncPanelState ? { syncPanelState } : {}),
  };

  return NextResponse.json(responsePayload);
}
