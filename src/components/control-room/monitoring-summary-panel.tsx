"use client";

import {
  DEFAULT_SYNC_PANEL_STATE,
  useOptionalControlRoomState,
} from "@/components/control-room/control-room-state";
import {
  DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
  buildMonitoringSummaryState,
} from "@/lib/chat/control-room-state";

export function MonitoringSummaryPanel() {
  const controlRoomState = useOptionalControlRoomState();
  const monitoringSummary = buildMonitoringSummaryState(
    controlRoomState?.monitoringExportStatus ??
      DEFAULT_MONITORING_EXPORT_STATUS_SOURCE,
  );
  const syncHealth =
    controlRoomState?.syncPanelState?.syncHealth ??
    DEFAULT_SYNC_PANEL_STATE.syncHealth;

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
          Monitoring Status
        </p>
        <p className="mt-3 text-lg font-medium text-white">
          {monitoringSummary.value}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {monitoringSummary.detail}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
          Sync Health
        </p>
        <p className="mt-3 text-lg font-medium text-white">{syncHealth.value}</p>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {syncHealth.detail}
        </p>
      </div>
    </div>
  );
}
