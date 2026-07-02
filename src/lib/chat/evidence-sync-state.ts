import type { ControlGapState } from "@/lib/chat/control-gap-state";
import {
  createDefaultControlGapState,
  saveResolvedControlGapState,
} from "@/lib/chat/control-gap-state";
import {
  loadEvidenceSyncState,
  saveEvidenceSyncState,
  type PersistedEvidenceSyncState,
} from "@/lib/db/evidence-sync-state";

export type EvidenceSyncState = PersistedEvidenceSyncState;

export type SyncPanelState = {
  connectedSources: Array<{
    sourceId: string;
    name: string;
    status: string;
    detail: string;
    lastSyncLabel: string;
  }>;
  syncHealth: {
    value: string;
    detail: string;
  };
  controlExportStatuses: Array<{
    controlId: string;
    status: string;
    detail: string;
  }>;
};

type ConnectEvidenceSourceInput = {
  sourceType: "github";
  repo: string;
  connectedAt?: string;
};

type SyncEvidenceSourceInput = {
  sourceId: string;
  syncedAt?: string;
};

function normalizeRepo(repo: string): string {
  return repo.trim().replace(/^https:\/\/github\.com\//i, "").replace(/\/+$/, "");
}

function buildSourceId(sourceType: "github", repo: string): string {
  return `${sourceType}:${normalizeRepo(repo).toLowerCase()}`;
}

function buildEvidenceId(sourceId: string, kind: string): string {
  return `${sourceId}:${kind}`;
}

function buildGitHubEvidenceRecords(sourceId: string, syncedAt: string) {
  return [
    {
      evidenceId: buildEvidenceId(sourceId, "commit"),
      sourceId,
      kind: "commit" as const,
      label: "Recent production commit history",
      capturedAt: syncedAt,
      mappedControlId: "CC7.2",
      exportStatus: "ready" as const,
      note: "Normalized from GitHub commit activity.",
    },
    {
      evidenceId: buildEvidenceId(sourceId, "pr_review"),
      sourceId,
      kind: "pr_review" as const,
      label: "Pull request review approvals",
      capturedAt: syncedAt,
      mappedControlId: "CC8.1",
      exportStatus: "ready" as const,
      note: "Normalized from GitHub review history.",
    },
    {
      evidenceId: buildEvidenceId(sourceId, "ci_result"),
      sourceId,
      kind: "ci_result" as const,
      label: "Default branch CI results",
      capturedAt: syncedAt,
      mappedControlId: "CC7.2",
      exportStatus: "ready" as const,
      note: "Normalized from GitHub workflow runs.",
    },
    {
      evidenceId: buildEvidenceId(sourceId, "branch_protection"),
      sourceId,
      kind: "branch_protection" as const,
      label: "Branch protection rules",
      capturedAt: syncedAt,
      mappedControlId: "CC6.1",
      exportStatus: "ready" as const,
      note: "Normalized from GitHub branch protection settings.",
    },
    {
      evidenceId: buildEvidenceId(sourceId, "repository_note"),
      sourceId,
      kind: "repository_note" as const,
      label: "Repository metadata note",
      capturedAt: syncedAt,
      mappedControlId: null,
      exportStatus: "action_required" as const,
      note: "Collected but not automatically mappable to a Sprinto control.",
    },
  ];
}

function hasEvidenceForControl(
  state: EvidenceSyncState,
  controlId: string,
  kinds: EvidenceSyncState["evidenceRecords"][number]["kind"][],
): boolean {
  return kinds.every((kind) =>
    state.evidenceRecords.some(
      (record) =>
        record.kind === kind &&
        record.mappedControlId === controlId &&
        record.exportStatus === "ready",
    ),
  );
}

function latestSyncTime(state: EvidenceSyncState): string | null {
  return state.sources.reduce<string | null>((latest, source) => {
    if (!source.lastSyncedAt) {
      return latest;
    }
    if (!latest || source.lastSyncedAt > latest) {
      return source.lastSyncedAt;
    }
    return latest;
  }, null);
}

function buildControlStateFromEvidenceSyncState(
  state: EvidenceSyncState,
): ControlGapState {
  const fallback = createDefaultControlGapState(state.conversationId);
  const repo = state.sources[0]?.repo ?? "acme/api";
  const syncedAt = latestSyncTime(state);
  const hasBranchProtection = hasEvidenceForControl(state, "CC6.1", [
    "branch_protection",
  ]);
  const hasChangeManagement = hasEvidenceForControl(state, "CC7.2", [
    "commit",
    "ci_result",
  ]);
  const hasPrReview = hasEvidenceForControl(state, "CC8.1", ["pr_review"]);

  const cc61 = {
    controlId: "CC6.1",
    title: "Access review evidence chain",
    repo,
    status: hasBranchProtection ? "healthy" : "missing",
    exportStatus: hasBranchProtection ? "ready" : "action_required",
    exportPhase: "idle" as const,
    missingEvidence: hasBranchProtection ? [] : ["Branch protection state"],
    nextAction: hasBranchProtection
      ? "Continue monitoring CC6.1 branch protection evidence."
      : "Sync GitHub branch protection evidence into CC6.1.",
    exceptionSummary: hasBranchProtection
      ? []
      : ["Branch protection evidence has not been collected yet."],
    evidenceRecords: hasBranchProtection
      ? [
          {
            evidenceId: "CC6.1-branch-protection",
            label: "Branch protection rules",
            status: "attached" as const,
            note: "Mapped from GitHub source sync.",
            updatedAt: syncedAt,
          },
        ]
      : [
          {
            evidenceId: "CC6.1-branch-protection",
            label: "Branch protection rules",
            status: "missing" as const,
            note: null,
            updatedAt: null,
          },
        ],
  };

  const cc72 = {
    controlId: "CC7.2",
    title: "Change management evidence chain",
    repo,
    status: hasChangeManagement ? "healthy" : "missing",
    exportStatus: hasChangeManagement ? "ready" : "action_required",
    exportPhase: "idle" as const,
    missingEvidence: hasChangeManagement
      ? []
      : ["Commit history", "CI verification results"],
    nextAction: hasChangeManagement
      ? "Continue monitoring CC7.2 change evidence freshness."
      : "Sync GitHub commits and CI evidence into CC7.2.",
    exceptionSummary: hasChangeManagement
      ? []
      : ["Change evidence remains incomplete until commit and CI records sync."],
    evidenceRecords: [
      {
        evidenceId: "CC7.2-commit",
        label: "Commit history",
        status: hasChangeManagement ? "attached" : "missing",
        note: hasChangeManagement ? "Mapped from GitHub source sync." : null,
        updatedAt: hasChangeManagement ? syncedAt : null,
      },
      {
        evidenceId: "CC7.2-ci",
        label: "CI verification results",
        status: hasChangeManagement ? "attached" : "missing",
        note: hasChangeManagement ? "Mapped from GitHub source sync." : null,
        updatedAt: hasChangeManagement ? syncedAt : null,
      },
    ],
  };

  const cc81 = {
    ...fallback.controls[0],
    repo,
    status: hasPrReview ? "stale" : "missing",
    exportStatus: "action_required" as const,
    exportPhase: "idle" as const,
    missingEvidence: hasPrReview
      ? ["Release approval screenshot"]
      : ["GitHub PR approval evidence", "Release approval screenshot"],
    nextAction: hasPrReview
      ? "Attach the release approval screenshot to CC8.1 and rerun the Sprinto sync check."
      : "Sync GitHub PR review evidence, then attach the release approval screenshot to CC8.1.",
    exceptionSummary: hasPrReview
      ? ["Release approval screenshot is still missing for CC8.1."]
      : [
          "GitHub PR approval evidence has not been synced for CC8.1.",
          "Release approval screenshot is still missing for CC8.1.",
        ],
    evidenceRecords: [
      {
        evidenceId: "CC8.1-pr-review",
        label: "GitHub PR approval evidence",
        status: hasPrReview ? "attached" : "missing",
        note: hasPrReview ? "Mapped from GitHub source sync." : null,
        updatedAt: hasPrReview ? syncedAt : null,
      },
      {
        evidenceId: "release-approval-screenshot",
        label: "Release approval screenshot",
        status: "missing" as const,
        note: null,
        updatedAt: null,
      },
    ],
  };

  return {
    conversationId: state.conversationId,
    primaryControlId: "CC8.1",
    updatedAt: state.updatedAt,
    controls: [cc81, cc61, cc72],
  };
}

export function createEmptyEvidenceSyncState(
  conversationId: string,
): EvidenceSyncState {
  return {
    conversationId,
    updatedAt: "2026-03-29T12:00:00.000Z",
    sources: [],
    evidenceRecords: [],
  };
}

export async function loadOrCreateEvidenceSyncState(
  conversationId: string,
): Promise<EvidenceSyncState> {
  const existing = await loadEvidenceSyncState(conversationId);
  if (existing) {
    return existing;
  }

  const created = createEmptyEvidenceSyncState(conversationId);
  await saveEvidenceSyncState(conversationId, created);
  return created;
}

export function connectEvidenceSource(
  state: EvidenceSyncState,
  input: ConnectEvidenceSourceInput,
): EvidenceSyncState {
  const repo = normalizeRepo(input.repo);
  const sourceId = buildSourceId(input.sourceType, repo);
  const connectedAt = input.connectedAt ?? "2026-03-29T12:00:00.000Z";
  const existing = state.sources.find((source) => source.sourceId === sourceId);

  if (existing) {
    return {
      ...state,
      updatedAt: connectedAt,
      sources: state.sources.map((source) =>
        source.sourceId === sourceId
          ? {
              ...source,
              status: "connected",
            }
          : { ...source },
      ),
      evidenceRecords: state.evidenceRecords.map((record) => ({ ...record })),
    };
  }

  return {
    ...state,
    updatedAt: connectedAt,
    sources: [
      ...state.sources.map((source) => ({ ...source })),
      {
        sourceId,
        sourceType: input.sourceType,
        repo,
        connectedAt,
        lastSyncedAt: null,
        status: "connected",
      },
    ],
    evidenceRecords: state.evidenceRecords.map((record) => ({ ...record })),
  };
}

export function syncEvidenceSource(
  state: EvidenceSyncState,
  input: SyncEvidenceSourceInput,
): EvidenceSyncState {
  const syncedAt = input.syncedAt ?? "2026-03-29T12:15:00.000Z";
  const source = state.sources.find((entry) => entry.sourceId === input.sourceId);

  if (!source) {
    return {
      ...state,
      updatedAt: syncedAt,
      sources: state.sources.map((entry) => ({ ...entry })),
      evidenceRecords: state.evidenceRecords.map((record) => ({ ...record })),
    };
  }

  const nextEvidence = buildGitHubEvidenceRecords(source.sourceId, syncedAt);

  return {
    ...state,
    updatedAt: syncedAt,
    sources: state.sources.map((entry) =>
      entry.sourceId === input.sourceId
        ? {
            ...entry,
            lastSyncedAt: syncedAt,
            status: "synced",
          }
        : { ...entry },
    ),
    evidenceRecords: [
      ...state.evidenceRecords
        .filter((record) => record.sourceId !== input.sourceId)
        .map((record) => ({ ...record })),
      ...nextEvidence,
    ],
  };
}

export async function saveResolvedEvidenceSyncState(
  state: EvidenceSyncState,
): Promise<void> {
  await saveEvidenceSyncState(state.conversationId, state);
}

export function deriveSyncPanelState(
  state: EvidenceSyncState,
): SyncPanelState {
  const connectedSources = state.sources.map((source) => ({
    sourceId: source.sourceId,
    name: `GitHub ${source.repo}`,
    status: source.status === "synced" ? "Synced" : "Connected",
    detail:
      source.status === "synced"
        ? `${state.evidenceRecords.filter((record) => record.sourceId === source.sourceId).length} evidence artifacts normalized from ${source.repo}.`
        : `${source.repo} is connected and ready for evidence collection.`,
    lastSyncLabel: source.lastSyncedAt
      ? `Last sync ${source.lastSyncedAt}`
      : "Last sync pending",
  }));

  const unmappableCount = state.evidenceRecords.filter(
    (record) => record.mappedControlId === null,
  ).length;
  const readyCount = state.evidenceRecords.filter(
    (record) => record.exportStatus === "ready",
  ).length;
  const healthValue =
    connectedSources.length === 0
      ? "No sources connected"
      : unmappableCount > 0
        ? "Attention required"
        : state.sources.some((source) => source.status !== "synced")
          ? "Sync pending"
          : "Healthy";

  const healthDetail =
    connectedSources.length === 0
      ? "Connect a GitHub repository to start evidence collection."
      : unmappableCount > 0
        ? `${readyCount} mapped evidence artifacts are ready; ${unmappableCount} artifact requires operator mapping.`
        : state.sources.some((source) => source.status !== "synced")
          ? "Connected sources are waiting for their first evidence sync."
          : `All connected sources are synced and ${readyCount} mapped evidence artifacts are export-ready.`;

  const controlState = buildControlStateFromEvidenceSyncState(state);
  const controlExportStatuses = controlState.controls.map((control) => ({
    controlId: control.controlId,
    status:
      control.exportStatus === "ready"
        ? "Ready"
        : control.status === "stale"
          ? "Action required (stale)"
          : "Action required",
    detail:
      control.exportStatus === "ready"
        ? `Latest evidence for ${control.controlId} is ready for Sprinto export.`
        : `Missing: ${control.missingEvidence.join(", ")}.`,
  }));

  return {
    connectedSources,
    syncHealth: {
      value: healthValue,
      detail: healthDetail,
    },
    controlExportStatuses,
  };
}

export function deriveControlGapStateFromEvidenceSyncState(
  state: EvidenceSyncState,
): ControlGapState {
  return buildControlStateFromEvidenceSyncState(state);
}

export async function persistDerivedControlGapStateFromEvidenceSync(
  state: EvidenceSyncState,
): Promise<ControlGapState> {
  const controlGapState = deriveControlGapStateFromEvidenceSyncState(state);
  await saveResolvedControlGapState(controlGapState);
  return controlGapState;
}
