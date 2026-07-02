export type BrowserCaptureEvidenceState = {
  status: string;
  detail: string;
};

export type MonitoringSummaryState = {
  value: string;
  detail: string;
};

export type MonitoringExportStatusSource = {
  phase: "preview" | "evidence-refresh-queued" | "unavailable";
  controlId: string | null;
};

export type ControlMappingState = {
  note: string;
};

export type ExceptionSummaryState = {
  items: string[];
};

export type ExceptionExportStatusSource = {
  browserCapturePhase: "standby" | "queued" | "unavailable";
  releaseVerificationPhase: "at-risk" | "capture-queued" | "unavailable";
};

export type ControlRoomExecutionSource = {
  exceptionExportSource: ExceptionExportStatusSource;
  monitoringExportStatusSource: MonitoringExportStatusSource;
};

export type ReleaseVerificationState = {
  status: string;
  freshness: string;
};

export type ChatControlRoomState = {
  nextRecommendedAction: string;
  missingEvidence: string;
  browserCapture: BrowserCaptureEvidenceState;
  monitoringExportStatus: MonitoringExportStatusSource;
  cc81ControlMapping: ControlMappingState;
  exceptionSummary: ExceptionSummaryState;
  releaseVerification: ReleaseVerificationState;
};

export const DEFAULT_NEXT_RECOMMENDED_ACTION =
  "Capture a browser-based approval artifact and attach it to CC8.1 before export.";
export const DEFAULT_MISSING_EVIDENCE =
  "Release verification still lacks a screenshot from the production change window.";
export const DEFAULT_BROWSER_CAPTURE_EVIDENCE_STATE: BrowserCaptureEvidenceState =
  {
    status: "Standby",
    detail: "Screenshot and video evidence jobs are not configured yet.",
  };
export const DEFAULT_MONITORING_SUMMARY_STATE: MonitoringSummaryState = {
  value: "Preview mode",
  detail: "Continuous checks are represented with stable mock timing only.",
};
export const DEFAULT_MONITORING_EXPORT_STATUS_SOURCE: MonitoringExportStatusSource =
  {
    phase: "preview",
    controlId: null,
  };
export const QUEUED_MONITORING_EXPORT_STATUS_SOURCE: MonitoringExportStatusSource =
  {
    phase: "evidence-refresh-queued",
    controlId: "CC8.1",
  };
export const UNAVAILABLE_MONITORING_EXPORT_STATUS_SOURCE: MonitoringExportStatusSource =
  {
    phase: "unavailable",
    controlId: null,
  };
export const DEFAULT_CC81_CONTROL_MAPPING_STATE: ControlMappingState = {
  note: "Every export preview keeps the evidence chain visible before sync.",
};
export const DEFAULT_RELEASE_VERIFICATION_STATE: ReleaseVerificationState = {
  status: "At risk",
  freshness: "Missing supporting evidence",
};
export const DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE: ExceptionExportStatusSource =
  {
    browserCapturePhase: "standby",
    releaseVerificationPhase: "at-risk",
  };
export const UNAVAILABLE_BROWSER_CAPTURE_EVIDENCE_STATE: BrowserCaptureEvidenceState =
  {
    status: "Unavailable",
    detail: "Conversation thread payload omitted derived evidence state.",
  };
export const UNAVAILABLE_RELEASE_VERIFICATION_STATE: ReleaseVerificationState =
  {
    status: "Unavailable",
    freshness: "Conversation thread payload omitted derived control state.",
  };
export const UNAVAILABLE_EXCEPTION_EXPORT_STATUS_SOURCE: ExceptionExportStatusSource =
  {
    browserCapturePhase: "unavailable",
    releaseVerificationPhase: "unavailable",
  };

export function buildBrowserCaptureEvidenceState(
  source: ExceptionExportStatusSource,
): BrowserCaptureEvidenceState {
  if (source.browserCapturePhase === "queued") {
    return {
      status: "Queued",
      detail:
        "Release approval screenshot capture is queued for CC8.1 evidence collection.",
    };
  }

  if (source.browserCapturePhase === "unavailable") {
    return UNAVAILABLE_BROWSER_CAPTURE_EVIDENCE_STATE;
  }

  return DEFAULT_BROWSER_CAPTURE_EVIDENCE_STATE;
}

export function buildReleaseVerificationState(
  source: ExceptionExportStatusSource,
): ReleaseVerificationState {
  if (source.releaseVerificationPhase === "capture-queued") {
    return {
      status: "Capture queued",
      freshness: "Screenshot capture is queued for the missing CC8.1 evidence.",
    };
  }

  if (source.releaseVerificationPhase === "unavailable") {
    return UNAVAILABLE_RELEASE_VERIFICATION_STATE;
  }

  return DEFAULT_RELEASE_VERIFICATION_STATE;
}

export function buildExceptionSummaryState(
  source: ExceptionExportStatusSource,
): ExceptionSummaryState {
  const browserCapture = buildBrowserCaptureEvidenceState(source);
  const releaseVerification = buildReleaseVerificationState(source);
  const releaseVerificationException =
    releaseVerification.status === "Capture queued"
      ? "Release verification remains open until the queued CC8.1 screenshot lands."
      : releaseVerification.status === "Unavailable"
        ? "Release verification state unavailable from the operator route."
        : "Release verification control lacks screenshot confirmation.";

  const browserCaptureException =
    browserCapture.status === "Queued"
      ? "Browser capture evidence collection is queued for the missing release approval screenshot."
      : browserCapture.status === "Unavailable"
        ? "Browser capture evidence state unavailable from the operator route."
        : "Browser capture evidence jobs are not configured yet.";

  return {
    items: [releaseVerificationException, browserCaptureException],
  };
}

export const DEFAULT_EXCEPTION_SUMMARY_STATE = buildExceptionSummaryState(
  DEFAULT_EXCEPTION_EXPORT_STATUS_SOURCE,
);

export const UNAVAILABLE_EXCEPTION_SUMMARY_STATE = buildExceptionSummaryState(
  UNAVAILABLE_EXCEPTION_EXPORT_STATUS_SOURCE,
);

export const DEFAULT_CHAT_CONTROL_ROOM_STATE: ChatControlRoomState = {
  nextRecommendedAction: DEFAULT_NEXT_RECOMMENDED_ACTION,
  missingEvidence: DEFAULT_MISSING_EVIDENCE,
  browserCapture: DEFAULT_BROWSER_CAPTURE_EVIDENCE_STATE,
  monitoringExportStatus: DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
  cc81ControlMapping: DEFAULT_CC81_CONTROL_MAPPING_STATE,
  exceptionSummary: DEFAULT_EXCEPTION_SUMMARY_STATE,
  releaseVerification: DEFAULT_RELEASE_VERIFICATION_STATE,
};

export function buildQueuedBrowserCaptureEvidenceState(): BrowserCaptureEvidenceState {
  return buildBrowserCaptureEvidenceState({
    browserCapturePhase: "queued",
    releaseVerificationPhase: "capture-queued",
  });
}

export function buildMonitoringSummaryState(
  source: MonitoringExportStatusSource,
): MonitoringSummaryState {
  if (source.phase === "unavailable") {
    return {
      value: "Unavailable",
      detail: "Monitoring/export state unavailable from the operator route.",
    };
  }

  if (
    source.phase === "evidence-refresh-queued" &&
    source.controlId !== null
  ) {
    return {
      value: "Evidence refresh queued",
      detail: `Continuous checks for ${source.controlId} will rerun after the release approval screenshot lands.`,
    };
  }

  return DEFAULT_MONITORING_SUMMARY_STATE;
}

export function buildQueuedMonitoringExportStatusSource(): MonitoringExportStatusSource {
  return {
    ...QUEUED_MONITORING_EXPORT_STATUS_SOURCE,
  };
}

export function buildQueuedCc81ControlMappingState(): ControlMappingState {
  return {
    note: "Release approval screenshot will be attached to the CC8.1 Sprinto mapping before export sync.",
  };
}

export function buildGapResolutionControlRoomState({
  exceptionExportSource,
  monitoringExportStatusSource,
}: ControlRoomExecutionSource): ChatControlRoomState {
  const browserCapture = buildBrowserCaptureEvidenceState(exceptionExportSource);
  const releaseVerification =
    buildReleaseVerificationState(exceptionExportSource);

  return {
    nextRecommendedAction:
      "Attach the release approval screenshot to CC8.1 and rerun the Sprinto sync check.",
    missingEvidence:
      "Release verification now needs the release approval screenshot attached to CC8.1 before Sprinto sync can close.",
    browserCapture,
    monitoringExportStatus: monitoringExportStatusSource,
    cc81ControlMapping: buildQueuedCc81ControlMappingState(),
    exceptionSummary: buildExceptionSummaryState(exceptionExportSource),
    releaseVerification,
  };
}

export function buildUnavailableDerivedControlRoomState(): ChatControlRoomState {
  return {
    ...DEFAULT_CHAT_CONTROL_ROOM_STATE,
    browserCapture: buildBrowserCaptureEvidenceState(
      UNAVAILABLE_EXCEPTION_EXPORT_STATUS_SOURCE,
    ),
    monitoringExportStatus: UNAVAILABLE_MONITORING_EXPORT_STATUS_SOURCE,
    exceptionSummary: buildExceptionSummaryState(
      UNAVAILABLE_EXCEPTION_EXPORT_STATUS_SOURCE,
    ),
    releaseVerification: buildReleaseVerificationState(
      UNAVAILABLE_EXCEPTION_EXPORT_STATUS_SOURCE,
    ),
  };
}
