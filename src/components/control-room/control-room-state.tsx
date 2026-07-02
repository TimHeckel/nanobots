"use client";

import {
  type BrowserCaptureEvidenceState,
  type ControlMappingState,
  type ExceptionSummaryState,
  type MonitoringExportStatusSource,
} from "@/lib/chat/control-room-state";
import { buildControlRoomStateFromControlGapState } from "@/lib/chat/control-gap-state";
import {
  createEmptyEvidenceSyncState,
  deriveControlGapStateFromEvidenceSyncState,
  deriveSyncPanelState,
  type SyncPanelState,
} from "@/lib/chat/evidence-sync-state";
import { createContext, useContext, useState, type ReactNode } from "react";

const DEFAULT_CONVERSATION_ID = "new";
const DEFAULT_CONTROL_GAP_STATE = deriveControlGapStateFromEvidenceSyncState(
  createEmptyEvidenceSyncState(DEFAULT_CONVERSATION_ID),
);
const DEFAULT_CONTROL_ROOM_STATE = buildControlRoomStateFromControlGapState(
  DEFAULT_CONTROL_GAP_STATE,
);

export const DEFAULT_NEXT_RECOMMENDED_ACTION =
  DEFAULT_CONTROL_ROOM_STATE.nextRecommendedAction;
export const DEFAULT_MISSING_EVIDENCE = DEFAULT_CONTROL_ROOM_STATE.missingEvidence;
export const DEFAULT_RELEASE_VERIFICATION_STATUS =
  DEFAULT_CONTROL_ROOM_STATE.releaseVerification.status;
export const DEFAULT_RELEASE_VERIFICATION_FRESHNESS =
  DEFAULT_CONTROL_ROOM_STATE.releaseVerification.freshness;
export const DEGRADED_RELEASE_VERIFICATION_STATUS = "Unavailable";
export const DEGRADED_RELEASE_VERIFICATION_FRESHNESS =
  "Control health delta unavailable from the operator route.";
export const DEFAULT_SYNC_PANEL_STATE: SyncPanelState = deriveSyncPanelState(
  createEmptyEvidenceSyncState(DEFAULT_CONVERSATION_ID),
);

type ControlRoomStateContextValue = {
  nextRecommendedAction: string;
  setNextRecommendedAction: (value: string) => void;
  missingEvidence: string;
  setMissingEvidence: (value: string) => void;
  browserCapture: BrowserCaptureEvidenceState;
  setBrowserCapture: (value: BrowserCaptureEvidenceState) => void;
  monitoringExportStatus: MonitoringExportStatusSource;
  setMonitoringExportStatus: (value: MonitoringExportStatusSource) => void;
  cc81ControlMapping: ControlMappingState;
  setCc81ControlMapping: (value: ControlMappingState) => void;
  exceptionSummary: ExceptionSummaryState;
  setExceptionSummary: (value: ExceptionSummaryState) => void;
  releaseVerificationStatus: string;
  setReleaseVerificationStatus: (value: string) => void;
  releaseVerificationFreshness: string;
  setReleaseVerificationFreshness: (value: string) => void;
  syncPanelState: SyncPanelState;
  setSyncPanelState: (value: SyncPanelState) => void;
};

const ControlRoomStateContext =
  createContext<ControlRoomStateContextValue | null>(null);

export function ControlRoomStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [nextRecommendedAction, setNextRecommendedAction] = useState(
    DEFAULT_NEXT_RECOMMENDED_ACTION,
  );
  const [missingEvidence, setMissingEvidence] = useState(
    DEFAULT_MISSING_EVIDENCE,
  );
  const [browserCapture, setBrowserCapture] = useState<BrowserCaptureEvidenceState>(
    DEFAULT_CONTROL_ROOM_STATE.browserCapture,
  );
  const [monitoringExportStatus, setMonitoringExportStatus] =
    useState<MonitoringExportStatusSource>(
      DEFAULT_CONTROL_ROOM_STATE.monitoringExportStatus,
    );
  const [cc81ControlMapping, setCc81ControlMapping] =
    useState<ControlMappingState>(DEFAULT_CONTROL_ROOM_STATE.cc81ControlMapping);
  const [exceptionSummary, setExceptionSummary] =
    useState<ExceptionSummaryState>(DEFAULT_CONTROL_ROOM_STATE.exceptionSummary);
  const [releaseVerificationStatus, setReleaseVerificationStatus] = useState(
    DEFAULT_RELEASE_VERIFICATION_STATUS,
  );
  const [releaseVerificationFreshness, setReleaseVerificationFreshness] =
    useState(DEFAULT_RELEASE_VERIFICATION_FRESHNESS);
  const [syncPanelState, setSyncPanelState] =
    useState<SyncPanelState>(DEFAULT_SYNC_PANEL_STATE);

  return (
    <ControlRoomStateContext.Provider
      value={{
        nextRecommendedAction,
        setNextRecommendedAction,
        missingEvidence,
        setMissingEvidence,
        browserCapture,
        setBrowserCapture,
        monitoringExportStatus,
        setMonitoringExportStatus,
        cc81ControlMapping,
        setCc81ControlMapping,
        exceptionSummary,
        setExceptionSummary,
        releaseVerificationStatus,
        setReleaseVerificationStatus,
        releaseVerificationFreshness,
        setReleaseVerificationFreshness,
        syncPanelState,
        setSyncPanelState,
      }}
    >
      {children}
    </ControlRoomStateContext.Provider>
  );
}

export function useOptionalControlRoomState() {
  return useContext(ControlRoomStateContext);
}
