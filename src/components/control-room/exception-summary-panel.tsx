"use client";

import { useOptionalControlRoomState } from "@/components/control-room/control-room-state";
import { DEFAULT_EXCEPTION_SUMMARY_STATE } from "@/lib/chat/control-room-state";

export function ExceptionSummaryPanel() {
  const controlRoomState = useOptionalControlRoomState();
  const exceptionSummary =
    controlRoomState?.exceptionSummary ?? DEFAULT_EXCEPTION_SUMMARY_STATE;

  return (
    <div className="mt-6 space-y-4">
      {exceptionSummary.items.map((exception) => (
        <div
          key={exception}
          className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50"
        >
          {exception}
        </div>
      ))}
    </div>
  );
}
