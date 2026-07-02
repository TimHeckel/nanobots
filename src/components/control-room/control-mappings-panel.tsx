"use client";

import { useOptionalControlRoomState } from "@/components/control-room/control-room-state";
import { DEFAULT_CC81_CONTROL_MAPPING_STATE } from "@/lib/chat/control-room-state";

const STATIC_CONTROL_MAPPINGS = [
  {
    control: "CC7.2",
    label: "Sprinto Control Mapping",
    note: "Pull request reviews and release approvals are staged for export.",
  },
  {
    control: "CC6.1",
    label: "Mapped Controls",
    note: "Access review evidence remains linked to the operator thread.",
  },
  {
    control: "CC8.1",
    label: "Provable Middle",
    note: DEFAULT_CC81_CONTROL_MAPPING_STATE.note,
  },
] as const;

export function ControlMappingsPanel() {
  const controlRoomState = useOptionalControlRoomState();
  const cc81ControlMapping =
    controlRoomState?.cc81ControlMapping ?? DEFAULT_CC81_CONTROL_MAPPING_STATE;

  const resolvedControlMappings = STATIC_CONTROL_MAPPINGS.map((mapping) =>
    mapping.control === "CC8.1"
      ? {
          ...mapping,
          note: cc81ControlMapping.note,
        }
      : mapping,
  );

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      {resolvedControlMappings.map((mapping) => (
        <div
          key={mapping.control}
          className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
            {mapping.control}
          </p>
          <p className="mt-3 text-base font-medium text-white">
            {mapping.label}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{mapping.note}</p>
        </div>
      ))}
    </div>
  );
}
