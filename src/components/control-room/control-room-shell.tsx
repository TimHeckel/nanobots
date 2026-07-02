import { ControlMappingsPanel } from "@/components/control-room/control-mappings-panel";
import { ConversationThreadPanel } from "@/components/control-room/conversation-thread-panel";
import { ControlRoomStateProvider } from "@/components/control-room/control-room-state";
import { ControlHealthPanel } from "@/components/control-room/control-health-panel";
import { EvidenceSourcesGrid } from "@/components/control-room/evidence-sources-grid";
import { ExceptionSummaryPanel } from "@/components/control-room/exception-summary-panel";
import { GapResolutionPreviewGrid } from "@/components/control-room/gap-resolution-preview-grid";
import { MonitoringSummaryPanel } from "@/components/control-room/monitoring-summary-panel";
import { SprintoExportPanel } from "@/components/control-room/sprinto-export-panel";
import { Logo } from "@/components/shared/logo";
import type { ReactNode } from "react";

const evidenceConnectionActions = [
  {
    label: "Connect GitHub",
    detail: "Register a repository source so commits, PR approvals, CI results, and branch protection can be normalized into control evidence.",
  },
  {
    label: "Connect Screenshot Capture",
    detail: "Queue browser-based screenshot capture when a control requires non-GitHub release evidence.",
  },
];

const mediaEvidencePreview = [
  {
    title: "Capture Screenshot Evidence",
    detail: "Queue a stable screenshot artifact for controls that require visual proof.",
  },
  {
    title: "Capture Video Evidence",
    detail: "Recorded walkthrough capture is the next slice after screenshot evidence is wired through the local path.",
  },
  {
    title: "Media Evidence",
    detail: "Media artifacts are not captured yet, but the control room already tracks where they block export.",
  },
];

const operatorNotes = [
  "Conversation is the primary operator surface.",
  "Evidence panels stay visible beside the working thread.",
  "Sprinto remains the system of record for export and monitoring.",
];

export function ControlRoomShell({
  children,
  conversationId = "new",
}: {
  children?: ReactNode;
  conversationId?: string;
}) {
  return (
    <ControlRoomStateProvider>
      <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_42%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,1))]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <Logo size={30} />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">
                nanobots
              </p>
              <h1 className="text-lg font-semibold tracking-tight">
                Operator Control Room
              </h1>
            </div>
          </div>
          <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1 text-xs font-medium text-cyan-200">
            Sprinto-first SOC 2 middleware
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/40">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.28em] text-cyan-300/70">
            Operator Control Room
          </p>
          <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Assemble the provable middle between raw evidence and Sprinto control state.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            The default local path now reflects the same evidence, gap, and
            export-readiness state that the operator conversation mutates.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {operatorNotes.map((note) => (
              <div
                key={note}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300"
              >
                {note}
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/40">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300/70">
            Control Health
          </p>
          <ControlHealthPanel />
        </aside>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/40">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300/70">
                Connected Evidence Sources
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                Source connection state
              </h3>
            </div>
            <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1 text-xs font-medium text-emerald-200">
              Operator-managed evidence intake
            </div>
          </div>

          <EvidenceSourcesGrid />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {evidenceConnectionActions.map((action) => (
              <div
                key={action.label}
                className="rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/5 p-5"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  {action.label}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {action.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/40">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300/70">
            Conversation Entry
          </p>
          {children ?? <ConversationThreadPanel conversationId={conversationId} />}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-14">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/40">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300/70">
                Mapped Controls
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                Sprinto Control Mapping
              </h3>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
              Provable Middle
            </div>
          </div>

          <ControlMappingsPanel />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/40">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300/70">
            Monitoring Status
          </p>
          <MonitoringSummaryPanel />
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/40">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300/70">
            Exceptions
          </p>
          <ExceptionSummaryPanel />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/40">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300/70">
                Gap Resolution Preview
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                Conversation-guided next steps
              </h3>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
              Operator-derived state
            </div>
          </div>

          <GapResolutionPreviewGrid />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/40">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300/70">
                Sprinto Export Status
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                Local export readiness
              </h3>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
              No auto-sync side effects
            </div>
          </div>

          <SprintoExportPanel />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/40">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300/70">
                Media Evidence
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                Non-GitHub capture path
              </h3>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
              Next slice
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {mediaEvidencePreview.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  {item.title}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      </main>
    </ControlRoomStateProvider>
  );
}
