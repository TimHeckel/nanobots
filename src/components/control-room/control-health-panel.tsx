"use client";

import {
  DEFAULT_SYNC_PANEL_STATE,
  useOptionalControlRoomState,
} from "@/components/control-room/control-room-state";

export function ControlHealthPanel() {
  const controlRoomState = useOptionalControlRoomState();
  const syncStatuses =
    controlRoomState?.syncPanelState?.controlExportStatuses ??
    DEFAULT_SYNC_PANEL_STATE.controlExportStatuses;
  const resolvedControlHealth = syncStatuses.map((control) => ({
    control: control.controlId,
    status:
      control.controlId === "CC8.1"
        ? controlRoomState?.releaseVerificationStatus ?? control.status
        : control.status,
    freshness:
      control.controlId === "CC8.1"
        ? controlRoomState?.releaseVerificationFreshness ?? control.detail
        : control.detail,
  }));

  return (
    <div className="mt-6 space-y-4">
      {resolvedControlHealth.map((control) => (
        <div
          key={control.control}
          className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
        >
          <p className="text-sm font-medium text-white">{control.control}</p>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
            <span>{control.status}</span>
            <span>{control.freshness}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
