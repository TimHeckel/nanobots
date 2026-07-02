import type {
  ChatControlRoomState,
  ControlRoomExecutionSource,
} from "@/lib/chat/control-room-state";
import { DEFAULT_BROWSER_CAPTURE_EVIDENCE_STATE } from "@/lib/chat/control-room-state";
import {
  loadControlGapState,
  saveControlGapState,
  type PersistedControlGapState,
} from "@/lib/db/control-gap-state";

export type GapResolutionAction =
  | "attach_evidence"
  | "manual_review"
  | "trigger_rescan"
  | "escalate";

export type ControlGapState = PersistedControlGapState;

export type ControlGapEntity = ControlGapState["controls"][number];

export type ControlGapSummary = {
  controlId: string;
  status: ControlGapEntity["status"];
  exportStatus: ControlGapEntity["exportStatus"];
  missingEvidence: string[];
  nextAction: string;
};

export type ResolveControlGapResult = {
  success: boolean;
  message: string;
  state: ControlGapState;
  controlRoomState: ChatControlRoomState;
  executionSource: ControlRoomExecutionSource;
  mutatedControl: ControlGapEntity | null;
};

function buildHealthyControl(controlId: string, title: string): ControlGapEntity {
  return {
    controlId,
    title,
    repo: "acme/api",
    status: "healthy",
    exportStatus: "ready",
    exportPhase: "idle",
    missingEvidence: [],
    nextAction: `Continue monitoring ${controlId} for freshness drift.`,
    exceptionSummary: [],
    evidenceRecords: [
      {
        evidenceId: `${controlId}-baseline`,
        label: `${title} evidence bundle`,
        status: "attached",
        note: "Exported evidence is current.",
        updatedAt: "2026-03-26T09:15:00.000Z",
      },
    ],
  };
}

export function createDefaultControlGapState(
  conversationId: string,
): ControlGapState {
  return {
    conversationId,
    primaryControlId: "CC8.1",
    updatedAt: "2026-03-29T12:00:00.000Z",
    controls: [
      {
        controlId: "CC8.1",
        title: "Release approval evidence chain",
        repo: "acme/api",
        status: "missing",
        exportStatus: "action_required",
        exportPhase: "idle",
        missingEvidence: ["Release approval screenshot"],
        nextAction: "Attach the release approval screenshot to CC8.1 and rerun the Sprinto sync check.",
        exceptionSummary: [
          "Release approval screenshot is still missing for CC8.1.",
        ],
        evidenceRecords: [
          {
            evidenceId: "release-approval-screenshot",
            label: "Release approval screenshot",
            status: "missing",
            note: null,
            updatedAt: null,
          },
        ],
      },
      buildHealthyControl("CC6.1", "Access review evidence chain"),
    ],
  };
}

function summarizeMissingEvidence(control: ControlGapEntity): string {
  if (control.missingEvidence.length === 0) {
    return `No missing evidence for ${control.controlId}.`;
  }

  return `${control.missingEvidence.join(", ")} still missing for ${control.controlId}.`;
}

function buildHealthyState(): ChatControlRoomState {
  return {
    nextRecommendedAction: "Resume continuous monitoring across exported controls.",
    missingEvidence: "No missing evidence. All tracked controls are ready for Sprinto.",
    browserCapture: DEFAULT_BROWSER_CAPTURE_EVIDENCE_STATE,
    monitoringExportStatus: {
      phase: "preview",
      controlId: null,
    },
    cc81ControlMapping: {
      note: "Evidence remains linked to the exported control map.",
    },
    exceptionSummary: {
      items: [],
    },
    releaseVerification: {
      status: "Healthy",
      freshness: "Evidence is current and export-ready.",
    },
  };
}

export function buildExecutionSourceFromControlGapState(
  state: ControlGapState,
): ControlRoomExecutionSource {
  const focusControl =
    state.controls.find((control) => control.controlId === state.primaryControlId) ??
    state.controls[0];

  if (!focusControl) {
    return {
      exceptionExportSource: {
        browserCapturePhase: "standby",
        releaseVerificationPhase: "at-risk",
      },
      monitoringExportStatusSource: {
        phase: "preview",
        controlId: null,
      },
    };
  }

  return {
    exceptionExportSource: {
      browserCapturePhase: focusControl.evidenceRecords.some(
        (record) => record.status === "queued_scan",
      )
        ? "queued"
        : "standby",
      releaseVerificationPhase:
        focusControl.status === "healthy"
          ? "capture-queued"
          : focusControl.status === "blocked"
            ? "unavailable"
            : "at-risk",
    },
    monitoringExportStatusSource: {
      phase:
        focusControl.evidenceRecords.some((record) => record.status === "queued_scan")
          ? "evidence-refresh-queued"
          : focusControl.status === "blocked"
            ? "unavailable"
            : "preview",
      controlId:
        focusControl.status === "healthy" &&
        !focusControl.evidenceRecords.some((record) => record.status === "queued_scan")
          ? null
          : focusControl.controlId,
    },
  };
}

export function buildControlRoomStateFromControlGapState(
  state: ControlGapState,
): ChatControlRoomState {
  const actionable = state.controls.find(
    (control) =>
      control.controlId === state.primaryControlId ||
      control.status !== "healthy" ||
      control.exportStatus !== "ready",
  );

  if (!actionable || actionable.status === "healthy") {
    return buildHealthyState();
  }

  const queuedRefresh = actionable.evidenceRecords.some(
    (record) => record.status === "queued_scan",
  );
  const screenshotTracked = actionable.evidenceRecords.some((record) =>
    /screenshot/i.test(record.label),
  );

  return {
    nextRecommendedAction: actionable.nextAction,
    missingEvidence: summarizeMissingEvidence(actionable),
    browserCapture: {
      status: queuedRefresh ? "Queued" : "Standby",
      detail:
        queuedRefresh && screenshotTracked
          ? `Browser capture evidence refresh is queued for ${actionable.controlId}.`
          : screenshotTracked
            ? `Browser capture is waiting on ${actionable.controlId} evidence.`
            : "Browser capture evidence jobs are not configured yet.",
    },
    monitoringExportStatus: {
      phase: queuedRefresh
        ? "evidence-refresh-queued"
        : actionable.status === "blocked"
          ? "unavailable"
          : "preview",
      controlId: actionable.controlId,
    },
    cc81ControlMapping: {
      note: `Latest operator action is mapped to ${actionable.controlId}.`,
    },
    exceptionSummary: {
      items: [...actionable.exceptionSummary],
    },
    releaseVerification: {
      status:
        actionable.status === "blocked"
          ? "Blocked"
          : queuedRefresh
            ? "Capture queued"
            : "At risk",
      freshness:
        actionable.status === "blocked"
          ? `Export is blocked for ${actionable.controlId} until the escalation is cleared.`
          : queuedRefresh
            ? `Evidence refresh is queued for ${actionable.controlId}.`
            : summarizeMissingEvidence(actionable),
    },
  };
}

export async function loadOrCreateControlGapState(
  conversationId: string,
): Promise<ControlGapState> {
  const existing = await loadControlGapState(conversationId);
  if (existing) {
    return existing;
  }

  const created = createDefaultControlGapState(conversationId);
  await saveControlGapState(conversationId, created);
  return created;
}

export async function saveResolvedControlGapState(
  state: ControlGapState,
): Promise<void> {
  await saveControlGapState(state.conversationId, state);
}

export function inspectControlGaps(
  state: ControlGapState,
): {
  summaries: ControlGapSummary[];
  primaryControlId: string;
  controlRoomState: ChatControlRoomState;
  executionSource: ControlRoomExecutionSource;
} {
  const summaries = state.controls
    .filter(
      (control) =>
        control.status !== "healthy" || control.exportStatus !== "ready",
    )
    .map((control) => ({
      controlId: control.controlId,
      status: control.status,
      exportStatus: control.exportStatus,
      missingEvidence: [...control.missingEvidence],
      nextAction: control.nextAction,
    }));

  return {
    summaries,
    primaryControlId: state.primaryControlId,
    controlRoomState: buildControlRoomStateFromControlGapState(state),
    executionSource: buildExecutionSourceFromControlGapState(state),
  };
}

function buildUpdatedControl(
  control: ControlGapEntity,
  updates: Partial<ControlGapEntity>,
): ControlGapEntity {
  return {
    ...control,
    ...updates,
    missingEvidence: updates.missingEvidence
      ? [...updates.missingEvidence]
      : [...control.missingEvidence],
    exceptionSummary: updates.exceptionSummary
      ? [...updates.exceptionSummary]
      : [...control.exceptionSummary],
    evidenceRecords: updates.evidenceRecords
      ? updates.evidenceRecords.map((record) => ({ ...record }))
      : control.evidenceRecords.map((record) => ({ ...record })),
  };
}

function withUpdatedControl(
  state: ControlGapState,
  updatedControl: ControlGapEntity,
  updatedAt: string,
): ControlGapState {
  return {
    ...state,
    primaryControlId: updatedControl.controlId,
    updatedAt,
    controls: state.controls.map((control) =>
      control.controlId === updatedControl.controlId ? updatedControl : control,
    ),
  };
}

export function resolveControlGap(
  state: ControlGapState,
  input: {
    controlId: string;
    action: GapResolutionAction;
    evidenceId?: string;
    note?: string;
    updatedAt?: string;
  },
): ResolveControlGapResult {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const control = state.controls.find(
    (candidate) => candidate.controlId === input.controlId,
  );

  if (!control) {
    return {
      success: false,
      message: `Control ${input.controlId} is not tracked in this conversation.`,
      state,
      controlRoomState: buildControlRoomStateFromControlGapState(state),
      executionSource: buildExecutionSourceFromControlGapState(state),
      mutatedControl: null,
    };
  }

  if (control.exportPhase === "syncing") {
    return {
      success: false,
      message: `Control ${control.controlId} is mid-export and cannot be changed until the sync completes.`,
      state,
      controlRoomState: buildControlRoomStateFromControlGapState(state),
      executionSource: buildExecutionSourceFromControlGapState(state),
      mutatedControl: control,
    };
  }

  if (control.status === "healthy" && input.action !== "escalate") {
    return {
      success: false,
      message: `Control ${control.controlId} is already healthy and does not need a gap-resolution action.`,
      state,
      controlRoomState: buildControlRoomStateFromControlGapState(state),
      executionSource: buildExecutionSourceFromControlGapState(state),
      mutatedControl: control,
    };
  }

  let nextControl = buildUpdatedControl(control, {});

  switch (input.action) {
    case "attach_evidence": {
      const evidenceId = input.evidenceId ?? "";
      const target = nextControl.evidenceRecords.find(
        (record) => record.evidenceId === evidenceId,
      );

      if (!target) {
        return {
          success: false,
          message: `Evidence record ${evidenceId} is not tracked on ${control.controlId}.`,
          state,
          controlRoomState: buildControlRoomStateFromControlGapState(state),
          executionSource: buildExecutionSourceFromControlGapState(state),
          mutatedControl: control,
        };
      }

      nextControl = buildUpdatedControl(nextControl, {
        status: "healthy",
        exportStatus: "ready",
        missingEvidence: [],
        nextAction: `Resume continuous monitoring for ${control.controlId}.`,
        exceptionSummary: [],
        evidenceRecords: nextControl.evidenceRecords.map((record) =>
          record.evidenceId === evidenceId
            ? {
                ...record,
                status: "attached",
                note: input.note ?? "Evidence attached from operator conversation.",
                updatedAt,
              }
            : record,
        ),
      });
      break;
    }
    case "manual_review": {
      nextControl = buildUpdatedControl(nextControl, {
        status: "healthy",
        exportStatus: "ready",
        missingEvidence: [],
        nextAction: `Resume continuous monitoring for ${control.controlId}.`,
        exceptionSummary: [],
        evidenceRecords: nextControl.evidenceRecords.map((record) => ({
          ...record,
          status:
            record.status === "attached" ? "attached" : "manual_review",
          note: input.note ?? "Operator marked the evidence gap as manually reviewed.",
          updatedAt,
        })),
      });
      break;
    }
    case "trigger_rescan": {
      nextControl = buildUpdatedControl(nextControl, {
        status: "stale",
        exportStatus: "action_required",
        nextAction: `Wait for the evidence refresh on ${control.controlId} before the next Sprinto sync.`,
        exceptionSummary: [`Evidence refresh queued for ${control.controlId}.`],
        evidenceRecords: nextControl.evidenceRecords.map((record) => ({
          ...record,
          status:
            record.status === "attached" ? "attached" : "queued_scan",
          note: input.note ?? "Operator requested a re-scan from chat.",
          updatedAt,
        })),
      });
      break;
    }
    case "escalate": {
      nextControl = buildUpdatedControl(nextControl, {
        status: "blocked",
        exportStatus: "blocked",
        nextAction: `Assign a compliance owner to resolve ${control.controlId} before export resumes.`,
        exceptionSummary: [
          `Escalated ${control.controlId} for manual compliance review.`,
        ],
        evidenceRecords: nextControl.evidenceRecords.map((record) => ({
          ...record,
          status:
            record.status === "attached" ? "attached" : "escalated",
          note: input.note ?? "Operator escalated the unresolved control gap.",
          updatedAt,
        })),
      });
      break;
    }
  }

  const nextState = withUpdatedControl(state, nextControl, updatedAt);

  return {
    success: true,
    message:
      input.action === "attach_evidence"
        ? `Attached new evidence to ${control.controlId} and cleared the active gap.`
        : input.action === "manual_review"
          ? `Marked ${control.controlId} as manually reviewed and export-ready.`
          : input.action === "trigger_rescan"
            ? `Queued an evidence refresh for ${control.controlId}.`
            : `Escalated ${control.controlId} for manual compliance follow-up.`,
    state: nextState,
    controlRoomState: buildControlRoomStateFromControlGapState(nextState),
    executionSource: buildExecutionSourceFromControlGapState(nextState),
    mutatedControl: nextControl,
  };
}
