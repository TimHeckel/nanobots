"use client";

import {
  DEFAULT_SYNC_PANEL_STATE,
  useOptionalControlRoomState,
} from "@/components/control-room/control-room-state";

export type SprintoExportPanelState = {
  exportStatus: string;
  exportDetail: string;
  lastSyncLabel: string;
  lastSyncDetail: string;
  updateLabel: string;
  updateDetail: string;
};

export function buildSprintoExportPanelState(params: {
  connectedSourceCount: number;
  readyControlCount: number;
  blockedControlCount: number;
  actionRequiredControlCount: number;
}): SprintoExportPanelState {
  const {
    connectedSourceCount,
    readyControlCount,
    blockedControlCount,
    actionRequiredControlCount,
  } = params;

  if (connectedSourceCount === 0) {
    return {
      exportStatus: "Awaiting evidence sources",
      exportDetail:
        "Connect and sync at least one evidence source before preparing a Sprinto update.",
      lastSyncLabel: "No local export run",
      lastSyncDetail:
        "Sprinto export has not been attempted because the control room has no connected evidence sources yet.",
      updateLabel: "Connect a source first",
      updateDetail:
        "Use the operator conversation to connect GitHub and start evidence collection.",
    };
  }

  if (blockedControlCount > 0 || actionRequiredControlCount > 0) {
    return {
      exportStatus: "Action required",
      exportDetail:
        `${readyControlCount} controls are export-ready, but ${blockedControlCount + actionRequiredControlCount} control states still need operator work before Sprinto can be updated.`,
      lastSyncLabel: "Local state not exportable yet",
      lastSyncDetail:
        "The local path is holding the Sprinto update until missing evidence and exceptions are resolved.",
      updateLabel: "Resolve gaps before export",
      updateDetail:
        "Attach missing evidence or rerun sync from the conversation panel, then re-check export readiness.",
    };
  }

  return {
    exportStatus: "Ready to export",
    exportDetail:
      `${readyControlCount} controls are locally validated and ready for the next Sprinto update.`,
    lastSyncLabel: "No Sprinto push yet",
    lastSyncDetail:
      "The control room is showing verified local state only. A real Sprinto export should be initiated explicitly, not on page load.",
    updateLabel: "Export can proceed",
    updateDetail:
      "The current evidence set is complete enough to push an update into Sprinto when the operator chooses to sync.",
  };
}

export function SprintoExportPanelView({
  state,
}: {
  state: SprintoExportPanelState;
}) {
  const cards = [
    {
      label: "Sprinto Export Status",
      value: state.exportStatus,
      detail: state.exportDetail,
    },
    {
      label: "Last Sprinto Sync",
      value: state.lastSyncLabel,
      detail: state.lastSyncDetail,
    },
    {
      label: "Update Sprinto",
      value: state.updateLabel,
      detail: state.updateDetail,
    },
  ];

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      {cards.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
            {item.label}
          </p>
          <p className="mt-3 text-lg font-medium text-white">{item.value}</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function SprintoExportPanel() {
  const controlRoomState = useOptionalControlRoomState();
  const syncPanelState =
    controlRoomState?.syncPanelState ?? DEFAULT_SYNC_PANEL_STATE;
  const blockedControls = syncPanelState.controlExportStatuses.filter((control) =>
    /blocked/i.test(control.status),
  ).length;
  const readyControls = syncPanelState.controlExportStatuses.filter(
    (control) => control.status === "Ready",
  ).length;
  const actionRequiredControls =
    syncPanelState.controlExportStatuses.length - readyControls - blockedControls;
  const state = buildSprintoExportPanelState({
    connectedSourceCount: syncPanelState.connectedSources.length,
    readyControlCount: readyControls,
    blockedControlCount: blockedControls,
    actionRequiredControlCount: actionRequiredControls,
  });

  return <SprintoExportPanelView state={state} />;
}
