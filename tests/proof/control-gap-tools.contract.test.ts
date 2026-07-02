import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildControlRoomStateFromControlGapState,
  buildExecutionSourceFromControlGapState,
  createDefaultControlGapState,
  inspectControlGaps,
  loadOrCreateControlGapState,
  resolveControlGap,
  saveResolvedControlGapState,
} from "@/lib/chat/control-gap-state";
import { inspectControlGapsToolDef } from "@/lib/chat/tools/inspect-control-gaps";
import { resolveControlGapToolDef } from "@/lib/chat/tools/resolve-control-gap";
import {
  buildConversationThreadState,
  clearConversationControlRoomExecutionSource,
  loadConversationControlGapState,
  recordConversationControlRoomExecutionSource,
  resetConversationThreadMessages,
} from "@/lib/chat/conversation-thread-store";
import {
  loadControlGapState,
  resetControlGapStateStore,
  saveControlGapState,
  seedControlGapState,
} from "@/lib/db/control-gap-state";

describe("control gap tools contract", () => {
  function withSecondaryAttachedEvidence(conversationId: string) {
    const state = createDefaultControlGapState(conversationId);
    state.controls[0].evidenceRecords.push({
      evidenceId: "release-log-export",
      label: "Release log export",
      status: "attached",
      note: "Previously attached evidence.",
      updatedAt: "2026-03-28T12:00:00.000Z",
    });
    return state;
  }

  beforeEach(() => {
    resetControlGapStateStore();
    resetConversationThreadMessages();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetControlGapStateStore();
    resetConversationThreadMessages();
  });

  it("creates, saves, and reloads durable control gap state", async () => {
    const created = await loadOrCreateControlGapState("conv-gap");
    expect(created.primaryControlId).toBe("CC8.1");

    created.primaryControlId = "mutated-locally";

    const reloaded = await loadControlGapState("conv-gap");
    expect(reloaded?.primaryControlId).toBe("CC8.1");

    await saveControlGapState("conv-gap", {
      ...createDefaultControlGapState("conv-gap"),
      primaryControlId: "CC6.1",
    });
    await saveResolvedControlGapState({
      ...createDefaultControlGapState("conv-gap"),
      primaryControlId: "CC6.1",
    });

    await expect(loadControlGapState("conv-gap")).resolves.toEqual(
      expect.objectContaining({
        primaryControlId: "CC6.1",
      }),
    );
  });

  it("inspects actionable gaps and can include healthy controls on demand", async () => {
    const inspectTool = inspectControlGapsToolDef("conv-inspect");

    const defaultResult = await inspectTool.execute({ includeHealthy: false });
    expect(defaultResult.message).toBe("Found 1 actionable control gap(s).");
    expect(defaultResult.gaps).toEqual([
      expect.objectContaining({
        controlId: "CC8.1",
        status: "missing",
      }),
    ]);

    const fullResult = await inspectTool.execute({ includeHealthy: true });
    expect(fullResult.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlId: "CC8.1",
        }),
        expect.objectContaining({
          controlId: "CC6.1",
          status: "healthy",
        }),
      ]),
    );
  });

  it("reports a healthy inspection result when every control is already healthy", async () => {
    const healthyState = createDefaultControlGapState("conv-healthy");
    healthyState.primaryControlId = "CC6.1";
    healthyState.controls = healthyState.controls.map((control) => ({
      ...control,
      status: "healthy",
      exportStatus: "ready",
      missingEvidence: [],
      nextAction: `Continue monitoring ${control.controlId}.`,
      exceptionSummary: [],
      evidenceRecords: control.evidenceRecords.map((record) => ({
        ...record,
        status: "attached",
        updatedAt: "2026-03-29T12:00:00.000Z",
      })),
    }));
    seedControlGapState("conv-healthy", healthyState);

    const result = await inspectControlGapsToolDef("conv-healthy").execute({
      includeHealthy: false,
    });

    expect(result.message).toBe("All tracked controls are currently healthy.");
    expect(result.gaps).toEqual([]);
  });

  it("attaches evidence and clears the active gap in both the tool result and derived panel state", async () => {
    const result = await resolveControlGapToolDef("conv-attach").execute({
      controlId: "CC8.1",
      action: "attach_evidence",
      evidenceId: "release-approval-screenshot",
      note: "Screenshot uploaded from chat.",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Attached new evidence");
    expect(result.mutatedControl).toEqual(
      expect.objectContaining({
        controlId: "CC8.1",
        status: "healthy",
        exportStatus: "ready",
        missingEvidence: [],
      }),
    );
    expect(result.controlRoomState).toEqual(
      expect.objectContaining({
        missingEvidence: "No missing evidence. All tracked controls are ready for Sprinto.",
        monitoringExportStatus: { phase: "preview", controlId: null },
      }),
    );
    await expect(loadControlGapState("conv-attach")).resolves.toEqual(
      expect.objectContaining({
        primaryControlId: "CC8.1",
      }),
    );

    const defaultNoteResult = resolveControlGap(
      createDefaultControlGapState("conv-attach-default-note"),
      {
        controlId: "CC8.1",
        action: "attach_evidence",
        evidenceId: "release-approval-screenshot",
        updatedAt: "2026-03-29T12:00:00.000Z",
      },
    );
    expect(defaultNoteResult.mutatedControl?.evidenceRecords[0]).toEqual(
      expect.objectContaining({
        note: "Evidence attached from operator conversation.",
      }),
    );

    const multiRecordAttach = resolveControlGap(
      withSecondaryAttachedEvidence("conv-attach-secondary"),
      {
        controlId: "CC8.1",
        action: "attach_evidence",
        evidenceId: "release-approval-screenshot",
        updatedAt: "2026-03-29T12:00:00.000Z",
      },
    );
    expect(
      multiRecordAttach.mutatedControl?.evidenceRecords.find(
        (record) => record.evidenceId === "release-log-export",
      ),
    ).toEqual(
      expect.objectContaining({
        status: "attached",
      }),
    );
  });

  it("supports manual review, queued rescans, and escalation paths", () => {
    const base = withSecondaryAttachedEvidence("conv-actions");

    const manual = resolveControlGap(base, {
      controlId: "CC8.1",
      action: "manual_review",
      note: "Compliance owner reviewed the evidence manually.",
      updatedAt: "2026-03-29T12:30:00.000Z",
    });
    expect(manual.mutatedControl).toEqual(
      expect.objectContaining({
        status: "healthy",
        exportStatus: "ready",
      }),
    );
    expect(
      manual.mutatedControl?.evidenceRecords.find(
        (record) => record.evidenceId === "release-log-export",
      ),
    ).toEqual(
      expect.objectContaining({
        status: "attached",
      }),
    );

    const rescan = resolveControlGap(base, {
      controlId: "CC8.1",
      action: "trigger_rescan",
      note: "Rerun the evidence collector.",
      updatedAt: "2026-03-29T13:00:00.000Z",
    });
    expect(rescan.mutatedControl).toEqual(
      expect.objectContaining({
        status: "stale",
        exportStatus: "action_required",
      }),
    );
    expect(rescan.controlRoomState.monitoringExportStatus).toEqual({
      phase: "evidence-refresh-queued",
      controlId: "CC8.1",
    });

    const escalated = resolveControlGap(base, {
      controlId: "CC8.1",
      action: "escalate",
      note: "Route to compliance leadership.",
      updatedAt: "2026-03-29T14:00:00.000Z",
    });
    expect(escalated.mutatedControl).toEqual(
      expect.objectContaining({
        status: "blocked",
        exportStatus: "blocked",
      }),
    );
    expect(escalated.controlRoomState.releaseVerification.status).toBe("Blocked");
    expect(
      escalated.mutatedControl?.evidenceRecords.find(
        (record) => record.evidenceId === "release-log-export",
      ),
    ).toEqual(
      expect.objectContaining({
        status: "attached",
      }),
    );

    const defaultManualNote = resolveControlGap(
      createDefaultControlGapState("conv-manual-default"),
      {
        controlId: "CC8.1",
        action: "manual_review",
        updatedAt: "2026-03-29T12:00:00.000Z",
      },
    );
    expect(defaultManualNote.mutatedControl?.evidenceRecords[0]).toEqual(
      expect.objectContaining({
        note: "Operator marked the evidence gap as manually reviewed.",
      }),
    );
  });

  it("rejects unknown controls, already-healthy controls, syncing controls, and missing evidence records", async () => {
    const state = createDefaultControlGapState("conv-edge");
    state.controls[0].exportPhase = "syncing";
    seedControlGapState("conv-edge", state);

    const syncing = await resolveControlGapToolDef("conv-edge").execute({
      controlId: "CC8.1",
      action: "attach_evidence",
      evidenceId: "release-approval-screenshot",
    });
    expect(syncing.success).toBe(false);
    expect(syncing.message).toContain("mid-export");

    const healthyState = createDefaultControlGapState("conv-healthy-edge");
    healthyState.controls[0] = {
      ...healthyState.controls[0],
      status: "healthy",
      exportStatus: "ready",
      missingEvidence: [],
      exceptionSummary: [],
      evidenceRecords: healthyState.controls[0].evidenceRecords.map((record) => ({
        ...record,
        status: "attached",
        updatedAt: "2026-03-29T12:00:00.000Z",
      })),
    };
    seedControlGapState("conv-healthy-edge", healthyState);

    const alreadyHealthy = await resolveControlGapToolDef("conv-healthy-edge").execute({
      controlId: "CC8.1",
      action: "manual_review",
    });
    expect(alreadyHealthy.success).toBe(false);
    expect(alreadyHealthy.message).toContain("already healthy");

    const missingEvidence = resolveControlGap(createDefaultControlGapState("conv-missing"), {
      controlId: "CC8.1",
      action: "attach_evidence",
      evidenceId: "unknown-evidence",
      updatedAt: "2026-03-29T12:00:00.000Z",
    });
    expect(missingEvidence.success).toBe(false);
    expect(missingEvidence.message).toContain("not tracked");

    const unknownControl = resolveControlGap(createDefaultControlGapState("conv-unknown"), {
      controlId: "CC9.9",
      action: "escalate",
      updatedAt: "2026-03-29T12:00:00.000Z",
    });
    expect(unknownControl.success).toBe(false);
    expect(unknownControl.message).toContain("not tracked");

    const missingEvidenceId = resolveControlGap(
      createDefaultControlGapState("conv-no-evidence-id"),
      {
        controlId: "CC8.1",
        action: "attach_evidence",
        updatedAt: "2026-03-29T12:00:00.000Z",
      },
    );
    expect(missingEvidenceId.success).toBe(false);
    expect(missingEvidenceId.message).toContain("Evidence record");
  });

  it("derives control-room state and execution sources for empty, queued, and blocked states", () => {
    const emptyState = {
      conversationId: "conv-empty",
      primaryControlId: "CC0.0",
      updatedAt: "2026-03-29T12:00:00.000Z",
      controls: [],
    };

    expect(buildControlRoomStateFromControlGapState(emptyState)).toEqual(
      expect.objectContaining({
        missingEvidence: "No missing evidence. All tracked controls are ready for Sprinto.",
      }),
    );
    expect(buildExecutionSourceFromControlGapState(emptyState)).toEqual({
      exceptionExportSource: {
        browserCapturePhase: "standby",
        releaseVerificationPhase: "at-risk",
      },
      monitoringExportStatusSource: {
        phase: "preview",
        controlId: null,
      },
    });

    const defaultState = createDefaultControlGapState("conv-default");
    const inspected = inspectControlGaps(defaultState);
    expect(inspected.controlRoomState.releaseVerification.status).toBe("At risk");

    const rescanState = resolveControlGap(defaultState, {
      controlId: "CC8.1",
      action: "trigger_rescan",
      updatedAt: "2026-03-29T12:00:00.000Z",
    }).state;
    expect(buildExecutionSourceFromControlGapState(rescanState)).toEqual({
      exceptionExportSource: {
        browserCapturePhase: "queued",
        releaseVerificationPhase: "at-risk",
      },
      monitoringExportStatusSource: {
        phase: "evidence-refresh-queued",
        controlId: "CC8.1",
      },
    });

    const blockedState = resolveControlGap(defaultState, {
      controlId: "CC8.1",
      action: "escalate",
      updatedAt: "2026-03-29T12:00:00.000Z",
    }).state;
    expect(buildExecutionSourceFromControlGapState(blockedState)).toEqual({
      exceptionExportSource: {
        browserCapturePhase: "standby",
        releaseVerificationPhase: "unavailable",
      },
      monitoringExportStatusSource: {
        phase: "unavailable",
        controlId: "CC8.1",
      },
    });

    const blockedWithoutMissing = {
      ...blockedState,
      controls: blockedState.controls.map((control) =>
        control.controlId === "CC8.1"
          ? {
              ...control,
              missingEvidence: [],
            }
          : control,
      ),
    };
    expect(
      buildControlRoomStateFromControlGapState(blockedWithoutMissing),
    ).toEqual(
      expect.objectContaining({
        missingEvidence: "No missing evidence for CC8.1.",
      }),
    );

    const noScreenshotState = {
      ...blockedWithoutMissing,
      controls: blockedWithoutMissing.controls.map((control) =>
        control.controlId === "CC8.1"
          ? {
              ...control,
              evidenceRecords: [
                {
                  evidenceId: "review-log",
                  label: "Review log export",
                  status: "escalated" as const,
                  note: "Escalated without screenshot evidence.",
                  updatedAt: "2026-03-29T12:00:00.000Z",
                },
              ],
            }
          : control,
      ),
    };
    expect(
      buildControlRoomStateFromControlGapState(noScreenshotState),
    ).toEqual(
      expect.objectContaining({
        browserCapture: expect.objectContaining({
          detail: "Browser capture evidence jobs are not configured yet.",
        }),
      }),
    );

    const healthyState = createDefaultControlGapState("conv-all-healthy");
    healthyState.primaryControlId = "CC6.1";
    healthyState.controls = healthyState.controls.map((control) => ({
      ...control,
      status: "healthy",
      exportStatus: "ready",
      missingEvidence: [],
      exceptionSummary: [],
      evidenceRecords: control.evidenceRecords.map((record) => ({
        ...record,
        status: "attached",
      })),
    }));
    expect(buildExecutionSourceFromControlGapState(healthyState)).toEqual({
      exceptionExportSource: {
        browserCapturePhase: "standby",
        releaseVerificationPhase: "capture-queued",
      },
      monitoringExportStatusSource: {
        phase: "preview",
        controlId: null,
      },
    });
  });

  it("hydrates a persisted control-gap snapshot into the conversation thread store", async () => {
    seedControlGapState("conv-hydrate-gap", createDefaultControlGapState("conv-hydrate-gap"));

    await expect(
      loadConversationControlGapState("conv-hydrate-gap"),
    ).resolves.toEqual(
      expect.objectContaining({
        primaryControlId: "CC8.1",
      }),
    );
  });

  it("returns an unavailable thread-state view when a record exists but its execution source was cleared", async () => {
    recordConversationControlRoomExecutionSource({
      conversationId: "conv-unavailable-gap",
      controlRoomExecutionSource: {
        exceptionExportSource: {
          browserCapturePhase: "standby",
          releaseVerificationPhase: "at-risk",
        },
        monitoringExportStatusSource: {
          phase: "preview",
          controlId: null,
        },
      },
    });
    clearConversationControlRoomExecutionSource("conv-unavailable-gap");

    await expect(
      buildConversationThreadState("conv-unavailable-gap"),
    ).resolves.toEqual(
      expect.objectContaining({
        controlRoomState: expect.objectContaining({
          monitoringExportStatus: {
            phase: "unavailable",
            controlId: null,
          },
        }),
      }),
    );
  });
});
