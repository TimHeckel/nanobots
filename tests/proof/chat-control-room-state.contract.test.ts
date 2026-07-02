import { describe, expect, it } from "vitest";
import {
  buildExceptionSummaryState,
  buildBrowserCaptureEvidenceState,
  DEFAULT_BROWSER_CAPTURE_EVIDENCE_STATE,
  DEFAULT_CC81_CONTROL_MAPPING_STATE,
  DEFAULT_CHAT_CONTROL_ROOM_STATE,
  DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
  DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
  DEFAULT_RELEASE_VERIFICATION_STATE,
  QUEUED_MONITORING_EXPORT_STATUS_SOURCE,
  UNAVAILABLE_BROWSER_CAPTURE_EVIDENCE_STATE,
  UNAVAILABLE_EXCEPTION_EXPORT_STATUS_SOURCE,
  UNAVAILABLE_MONITORING_EXPORT_STATUS_SOURCE,
  UNAVAILABLE_RELEASE_VERIFICATION_STATE,
  buildUnavailableDerivedControlRoomState,
  buildMonitoringSummaryState,
  buildGapResolutionControlRoomState,
  buildQueuedBrowserCaptureEvidenceState,
  buildReleaseVerificationState,
  buildQueuedMonitoringExportStatusSource,
} from "@/lib/chat/control-room-state";
import {
  QUEUED_CONTROL_ROOM_EXECUTION_SOURCE,
  QUEUED_EXCEPTION_EXPORT_EXECUTION_SOURCE,
} from "@/lib/chat/control-room-execution-source-seed";

describe("chat control-room state derivation", () => {
  it("derives the default browser capture card from shared evidence state", () => {
    expect(DEFAULT_CHAT_CONTROL_ROOM_STATE.browserCapture).toEqual(
      DEFAULT_BROWSER_CAPTURE_EVIDENCE_STATE,
    );
    expect(DEFAULT_CHAT_CONTROL_ROOM_STATE.browserCapture).toEqual({
      status: "Standby",
      detail: "Screenshot and video evidence jobs are not configured yet.",
    });
    expect(DEFAULT_CHAT_CONTROL_ROOM_STATE.monitoringExportStatus).toEqual(
      DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
    );
    expect(
      buildMonitoringSummaryState(
        DEFAULT_CHAT_CONTROL_ROOM_STATE.monitoringExportStatus,
      ),
    ).toEqual({
      value: "Preview mode",
      detail: "Continuous checks are represented with stable mock timing only.",
    });
    expect(DEFAULT_CHAT_CONTROL_ROOM_STATE.cc81ControlMapping).toEqual(
      DEFAULT_CC81_CONTROL_MAPPING_STATE,
    );
    expect(DEFAULT_CHAT_CONTROL_ROOM_STATE.cc81ControlMapping).toEqual({
      note: "Every export preview keeps the evidence chain visible before sync.",
    });
    expect(DEFAULT_CHAT_CONTROL_ROOM_STATE.releaseVerification).toEqual(
      DEFAULT_RELEASE_VERIFICATION_STATE,
    );
    expect(DEFAULT_CHAT_CONTROL_ROOM_STATE.releaseVerification).toEqual({
      status: "At risk",
      freshness: "Missing supporting evidence",
    });
  });

  it("builds the deterministic gap-resolution browser capture delta from shared evidence state", () => {
    expect(buildQueuedBrowserCaptureEvidenceState()).toEqual({
      status: "Queued",
      detail:
        "Release approval screenshot capture is queued for CC8.1 evidence collection.",
    });
    expect(QUEUED_MONITORING_EXPORT_STATUS_SOURCE).toEqual({
      phase: "evidence-refresh-queued",
      controlId: "CC8.1",
    });
    expect(
      buildMonitoringSummaryState(QUEUED_MONITORING_EXPORT_STATUS_SOURCE),
    ).toEqual({
      value: "Evidence refresh queued",
      detail:
        "Continuous checks for CC8.1 will rerun after the release approval screenshot lands.",
    });

    expect(
      buildGapResolutionControlRoomState(QUEUED_CONTROL_ROOM_EXECUTION_SOURCE),
    ).toEqual({
      nextRecommendedAction:
        "Attach the release approval screenshot to CC8.1 and rerun the Sprinto sync check.",
      missingEvidence:
        "Release verification now needs the release approval screenshot attached to CC8.1 before Sprinto sync can close.",
      browserCapture: {
        status: "Queued",
        detail:
          "Release approval screenshot capture is queued for CC8.1 evidence collection.",
      },
      monitoringExportStatus:
        QUEUED_CONTROL_ROOM_EXECUTION_SOURCE.monitoringExportStatusSource,
      cc81ControlMapping: {
        note: "Release approval screenshot will be attached to the CC8.1 Sprinto mapping before export sync.",
      },
      exceptionSummary: buildExceptionSummaryState(
        QUEUED_EXCEPTION_EXPORT_EXECUTION_SOURCE,
      ),
      releaseVerification: {
        status: "Capture queued",
        freshness: "Screenshot capture is queued for the missing CC8.1 evidence.",
      },
    });
  });

  it("derives exception summary from one structured exception/export source object", () => {
    expect(
      buildExceptionSummaryState(QUEUED_EXCEPTION_EXPORT_EXECUTION_SOURCE),
    ).toEqual({
      items: [
        "Release verification remains open until the queued CC8.1 screenshot lands.",
        "Browser capture evidence collection is queued for the missing release approval screenshot.",
      ],
    });

    expect(
      buildBrowserCaptureEvidenceState(DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE),
    ).toEqual(DEFAULT_BROWSER_CAPTURE_EVIDENCE_STATE);
    expect(
      buildReleaseVerificationState(DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE),
    ).toEqual(DEFAULT_RELEASE_VERIFICATION_STATE);
    expect(
      buildMonitoringSummaryState(UNAVAILABLE_MONITORING_EXPORT_STATUS_SOURCE),
    ).toEqual({
      value: "Unavailable",
      detail: "Monitoring/export state unavailable from the operator route.",
    });

    expect(
      buildGapResolutionControlRoomState({
        exceptionExportSource: DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
        monitoringExportStatusSource: DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
      }),
    ).toMatchObject({
      browserCapture: DEFAULT_BROWSER_CAPTURE_EVIDENCE_STATE,
      exceptionSummary: buildExceptionSummaryState(
        DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
      ),
      releaseVerification: DEFAULT_RELEASE_VERIFICATION_STATE,
    });
  });

  it("builds an explicit unavailable state when a route-backed thread omits derived panel data", () => {
    expect(buildUnavailableDerivedControlRoomState()).toEqual({
      ...DEFAULT_CHAT_CONTROL_ROOM_STATE,
      browserCapture: UNAVAILABLE_BROWSER_CAPTURE_EVIDENCE_STATE,
      monitoringExportStatus: UNAVAILABLE_MONITORING_EXPORT_STATUS_SOURCE,
      exceptionSummary: buildExceptionSummaryState(
        UNAVAILABLE_EXCEPTION_EXPORT_STATUS_SOURCE,
      ),
      releaseVerification: UNAVAILABLE_RELEASE_VERIFICATION_STATE,
    });
  });

  it("builds a fresh queued monitoring export status source", () => {
    const source = buildQueuedMonitoringExportStatusSource();
    expect(source).toEqual(QUEUED_MONITORING_EXPORT_STATUS_SOURCE);
    expect(source).not.toBe(QUEUED_MONITORING_EXPORT_STATUS_SOURCE);
  });
});
