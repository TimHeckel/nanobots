"use client";

import {
  DEFAULT_SYNC_PANEL_STATE,
  useOptionalControlRoomState,
} from "@/components/control-room/control-room-state";
import { DEFAULT_BROWSER_CAPTURE_EVIDENCE_STATE } from "@/lib/chat/control-room-state";

export function EvidenceSourcesGrid() {
  const controlRoomState = useOptionalControlRoomState();
  const browserCapture =
    controlRoomState?.browserCapture ?? DEFAULT_BROWSER_CAPTURE_EVIDENCE_STATE;
  const connectedSources =
    controlRoomState?.syncPanelState?.connectedSources ??
    DEFAULT_SYNC_PANEL_STATE.connectedSources;

  return (
    <div className="mt-6 grid gap-4">
      {connectedSources.length > 0 ? (
        connectedSources.map((source) => (
          <div
            key={source.sourceId}
            className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-lg font-medium text-white">{source.name}</p>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {source.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {source.detail}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              {source.lastSyncLabel}
            </p>
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/60 p-5">
          <p className="text-lg font-medium text-white">No evidence sources connected</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Connect a GitHub repository from the conversation panel to start
            collecting evidence and building Sprinto-ready mappings.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-lg font-medium text-white">Browser Capture</p>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
            {browserCapture.status}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {browserCapture.detail}
        </p>
      </div>
    </div>
  );
}
