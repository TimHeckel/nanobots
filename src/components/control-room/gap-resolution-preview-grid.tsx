"use client";

import {
  DEFAULT_MISSING_EVIDENCE,
  useOptionalControlRoomState,
} from "@/components/control-room/control-room-state";

const STATIC_GAP_RESOLUTION_ITEMS = [
  {
    title: "Resolve Evidence Gap",
    detail: "Prompt the operator to attach the missing release approval artifact.",
  },
] as const;

export function GapResolutionPreviewGrid() {
  const controlRoomState = useOptionalControlRoomState();
  const nextRecommendedAction =
    controlRoomState?.nextRecommendedAction ??
    "Capture a browser-based approval artifact and attach it to CC8.1 before export.";
  const missingEvidence =
    controlRoomState?.missingEvidence ?? DEFAULT_MISSING_EVIDENCE;

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      {STATIC_GAP_RESOLUTION_ITEMS.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
            {item.title}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</p>
        </div>
      ))}

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
          Missing Evidence
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {missingEvidence}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
          Next Recommended Action
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {nextRecommendedAction}
        </p>
      </div>
    </div>
  );
}
