import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  connectEvidenceSource,
  createEmptyEvidenceSyncState,
  deriveControlGapStateFromEvidenceSyncState,
  deriveSyncPanelState,
  loadOrCreateEvidenceSyncState,
  saveResolvedEvidenceSyncState,
  syncEvidenceSource,
} from "@/lib/chat/evidence-sync-state";
import { connectEvidenceSourceToolDef } from "@/lib/chat/tools/connect-evidence-source";
import { syncEvidenceSourceToolDef } from "@/lib/chat/tools/sync-evidence-source";
import {
  loadEvidenceSyncState,
  seedEvidenceSyncState,
  resetEvidenceSyncStateStore,
} from "@/lib/db/evidence-sync-state";
import {
  loadControlGapState,
  resetControlGapStateStore,
} from "@/lib/db/control-gap-state";

describe("evidence sync tools contract", () => {
  beforeEach(() => {
    resetEvidenceSyncStateStore();
    resetControlGapStateStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetEvidenceSyncStateStore();
    resetControlGapStateStore();
  });

  it("registers and durably persists a GitHub evidence source", async () => {
    const result = await connectEvidenceSourceToolDef("conv-source").execute({
      sourceType: "github",
      repo: "acme/api",
    });

    expect(result.message).toContain("Connected GitHub evidence source acme/api");
    expect(result.syncPanelState.connectedSources).toEqual([
      expect.objectContaining({
        sourceId: "github:acme/api",
        status: "Connected",
        lastSyncLabel: "Last sync pending",
      }),
    ]);

    await expect(loadEvidenceSyncState("conv-source")).resolves.toEqual(
      expect.objectContaining({
        sources: [
          expect.objectContaining({
            sourceId: "github:acme/api",
            repo: "acme/api",
            status: "connected",
          }),
        ],
      }),
    );
  });

  it("normalizes synced GitHub evidence into mapped and unmappable records", async () => {
    const connected = connectEvidenceSource(createEmptyEvidenceSyncState("conv-sync"), {
      sourceType: "github",
      repo: "acme/api",
      connectedAt: "2026-03-29T12:00:00.000Z",
    });
    const synced = syncEvidenceSource(connected, {
      sourceId: "github:acme/api",
      syncedAt: "2026-03-29T12:15:00.000Z",
    });

    expect(synced.evidenceRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "commit",
          mappedControlId: "CC7.2",
          exportStatus: "ready",
        }),
        expect.objectContaining({
          kind: "pr_review",
          mappedControlId: "CC8.1",
          exportStatus: "ready",
        }),
        expect.objectContaining({
          kind: "branch_protection",
          mappedControlId: "CC6.1",
          exportStatus: "ready",
        }),
        expect.objectContaining({
          kind: "repository_note",
          mappedControlId: null,
          exportStatus: "action_required",
        }),
      ]),
    );
  });

  it("derives control mapping state with healthy, stale, and unmappable outcomes", async () => {
    const base = await loadOrCreateEvidenceSyncState("conv-mapping");
    const connected = connectEvidenceSource(base, {
      sourceType: "github",
      repo: "acme/api",
    });
    const synced = syncEvidenceSource(connected, {
      sourceId: "github:acme/api",
    });
    await saveResolvedEvidenceSyncState(synced);

    const controlGapState = deriveControlGapStateFromEvidenceSyncState(synced);
    const syncPanelState = deriveSyncPanelState(synced);

    expect(controlGapState.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlId: "CC6.1",
          status: "healthy",
          exportStatus: "ready",
        }),
        expect.objectContaining({
          controlId: "CC7.2",
          status: "healthy",
          exportStatus: "ready",
        }),
        expect.objectContaining({
          controlId: "CC8.1",
          status: "stale",
          exportStatus: "action_required",
          missingEvidence: ["Release approval screenshot"],
        }),
      ]),
    );
    expect(syncPanelState.syncHealth).toEqual({
      value: "Attention required",
      detail:
        "4 mapped evidence artifacts are ready; 1 artifact requires operator mapping.",
    });
    expect(syncPanelState.controlExportStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlId: "CC6.1",
          status: "Ready",
        }),
        expect.objectContaining({
          controlId: "CC8.1",
          status: "Action required (stale)",
        }),
      ]),
    );
  });

  it("sync tool persists evidence state and derived control gaps for downstream chat flows", async () => {
    await connectEvidenceSourceToolDef("conv-tool-sync").execute({
      sourceType: "github",
      repo: "acme/api",
    });

    const result = await syncEvidenceSourceToolDef("conv-tool-sync").execute({
      sourceId: "github:acme/api",
    });

    expect(result.message).toBe(
      "Synced evidence from github:acme/api and refreshed control mappings.",
    );
    await expect(loadControlGapState("conv-tool-sync")).resolves.toEqual(
      expect.objectContaining({
        controls: expect.arrayContaining([
          expect.objectContaining({
            controlId: "CC8.1",
            missingEvidence: ["Release approval screenshot"],
          }),
        ]),
      }),
    );
  });

  it("reuses an existing source connection, normalizes GitHub URLs, and keeps the stored state cloned", async () => {
    const withEvidence = {
      ...createEmptyEvidenceSyncState("conv-existing"),
      evidenceRecords: [
        {
          evidenceId: "github:acme/api:note",
          sourceId: "github:acme/api",
          kind: "repository_note" as const,
          label: "Metadata note",
          capturedAt: "2026-03-29T12:00:00.000Z",
          mappedControlId: null,
          exportStatus: "action_required" as const,
          note: "seeded",
        },
      ],
    };
    const connected = connectEvidenceSource(withEvidence, {
      sourceType: "github",
      repo: "https://github.com/acme/api/",
      connectedAt: "2026-03-29T12:00:00.000Z",
    });
    const reconnected = connectEvidenceSource(connected, {
      sourceType: "github",
      repo: "acme/api",
      connectedAt: "2026-03-29T12:05:00.000Z",
    });

    expect(reconnected.sources).toHaveLength(1);
    expect(reconnected.sources[0]).toEqual(
      expect.objectContaining({
        sourceId: "github:acme/api",
        repo: "acme/api",
        status: "connected",
      }),
    );

    seedEvidenceSyncState("conv-seeded", reconnected);
    reconnected.sources[0].repo = "mutated/local";
    const seeded = await loadEvidenceSyncState("conv-seeded");
    expect(seeded?.sources[0].repo).toBe("acme/api");
    expect(
      connectEvidenceSource(
        {
          ...reconnected,
          sources: [
            ...reconnected.sources,
            {
              sourceId: "github:acme/web",
              sourceType: "github",
              repo: "acme/web",
              connectedAt: "2026-03-29T12:01:00.000Z",
              lastSyncedAt: null,
              status: "connected",
            },
          ],
        },
        {
          sourceType: "github",
          repo: "acme/api",
        },
      ).sources,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "github:acme/api",
          status: "connected",
        }),
        expect.objectContaining({
          sourceId: "github:acme/web",
        }),
      ]),
    );
  });

  it("covers empty, healthy, and missing-source sync branches", async () => {
    const empty = createEmptyEvidenceSyncState("conv-empty");
    expect(deriveSyncPanelState(empty)).toEqual({
      connectedSources: [],
      syncHealth: {
        value: "No sources connected",
        detail: "Connect a GitHub repository to start evidence collection.",
      },
      controlExportStatuses: expect.arrayContaining([
        expect.objectContaining({
          controlId: "CC8.1",
          status: "Action required",
        }),
      ]),
    });

    const missingSourceSync = syncEvidenceSource({
      ...empty,
      sources: [
        {
          sourceId: "github:acme/api",
          sourceType: "github",
          repo: "acme/api",
          connectedAt: "2026-03-29T12:00:00.000Z",
          lastSyncedAt: null,
          status: "connected",
        },
      ],
      evidenceRecords: [
        {
          evidenceId: "github:acme/api:repository_note",
          sourceId: "github:acme/api",
          kind: "repository_note",
          label: "Metadata note",
          capturedAt: "2026-03-29T12:00:00.000Z",
          mappedControlId: null,
          exportStatus: "action_required",
          note: "seeded",
        },
      ],
    }, {
      sourceId: "github:missing/repo",
      syncedAt: "2026-03-29T12:15:00.000Z",
    });
    expect(missingSourceSync).toEqual(
      expect.objectContaining({
        sources: [
          expect.objectContaining({
            sourceId: "github:acme/api",
          }),
        ],
        evidenceRecords: [
          expect.objectContaining({
            sourceId: "github:acme/api",
          }),
        ],
      }),
    );
    expect(
      await syncEvidenceSourceToolDef("conv-missing-tool").execute({
        sourceId: "github:missing/repo",
      }),
    ).toEqual(
      expect.objectContaining({
        message:
          "No connected evidence source found for github:missing/repo. Connect it before syncing.",
      }),
    );

    const healthy = {
      conversationId: "conv-healthy-panel",
      updatedAt: "2026-03-29T12:20:00.000Z",
      sources: [
        {
          sourceId: "github:acme/api",
          sourceType: "github" as const,
          repo: "acme/api",
          connectedAt: "2026-03-29T12:00:00.000Z",
          lastSyncedAt: "2026-03-29T12:20:00.000Z",
          status: "synced" as const,
        },
      ],
      evidenceRecords: [
        {
          evidenceId: "github:acme/api:commit",
          sourceId: "github:acme/api",
          kind: "commit" as const,
          label: "Commit history",
          capturedAt: "2026-03-29T12:20:00.000Z",
          mappedControlId: "CC7.2",
          exportStatus: "ready" as const,
          note: null,
        },
        {
          evidenceId: "github:acme/api:ci_result",
          sourceId: "github:acme/api",
          kind: "ci_result" as const,
          label: "CI",
          capturedAt: "2026-03-29T12:20:00.000Z",
          mappedControlId: "CC7.2",
          exportStatus: "ready" as const,
          note: null,
        },
        {
          evidenceId: "github:acme/api:branch_protection",
          sourceId: "github:acme/api",
          kind: "branch_protection" as const,
          label: "Branch protection",
          capturedAt: "2026-03-29T12:20:00.000Z",
          mappedControlId: "CC6.1",
          exportStatus: "ready" as const,
          note: null,
        },
        {
          evidenceId: "github:acme/api:pr_review",
          sourceId: "github:acme/api",
          kind: "pr_review" as const,
          label: "PR review",
          capturedAt: "2026-03-29T12:20:00.000Z",
          mappedControlId: "CC8.1",
          exportStatus: "ready" as const,
          note: null,
        },
      ],
    };

    expect(deriveSyncPanelState(healthy).syncHealth).toEqual({
      value: "Healthy",
      detail:
        "All connected sources are synced and 4 mapped evidence artifacts are export-ready.",
    });
    expect(deriveControlGapStateFromEvidenceSyncState(healthy).controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlId: "CC8.1",
          missingEvidence: ["Release approval screenshot"],
        }),
      ]),
    );

    const connected = connectEvidenceSource(createEmptyEvidenceSyncState("conv-resync"), {
      sourceType: "github",
      repo: "acme/api",
    });
    const resynced = syncEvidenceSource({
      ...connected,
      sources: [
        ...connected.sources,
        {
          sourceId: "github:acme/web",
          sourceType: "github",
          repo: "acme/web",
          connectedAt: "2026-03-29T12:01:00.000Z",
          lastSyncedAt: "2026-03-29T12:10:00.000Z",
          status: "synced",
        },
      ],
      evidenceRecords: [
        {
          evidenceId: "github:acme/web:commit",
          sourceId: "github:acme/web",
          kind: "commit",
          label: "Other source commit",
          capturedAt: "2026-03-29T12:10:00.000Z",
          mappedControlId: "CC7.2",
          exportStatus: "ready",
          note: null,
        },
      ],
    }, {
      sourceId: "github:acme/api",
      syncedAt: "2026-03-29T12:30:00.000Z",
    });
    const resyncedAgain = syncEvidenceSource(resynced, {
      sourceId: "github:acme/api",
      syncedAt: "2026-03-29T12:45:00.000Z",
    });
    expect(
      resyncedAgain.evidenceRecords.filter(
        (record) => record.sourceId === "github:acme/api",
      ),
    ).toHaveLength(5);
    expect(
      connectEvidenceSource(
        {
          ...createEmptyEvidenceSyncState("conv-second-source"),
          sources: [
            {
              sourceId: "github:acme/api",
              sourceType: "github",
              repo: "acme/api",
              connectedAt: "2026-03-29T12:00:00.000Z",
              lastSyncedAt: "2026-03-29T12:40:00.000Z",
              status: "synced",
            },
          ],
        },
        {
          sourceType: "github",
          repo: "acme/web",
        },
      ).sources,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "github:acme/api",
        }),
        expect.objectContaining({
          sourceId: "github:acme/web",
        }),
      ]),
    );

    expect(
      deriveSyncPanelState({
        ...healthy,
        sources: [
          {
            ...healthy.sources[0],
            sourceId: "github:acme/older",
            repo: "acme/older",
            lastSyncedAt: "2026-03-29T12:00:00.000Z",
          },
          healthy.sources[0],
        ],
      }).connectedSources,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "github:acme/older",
          lastSyncLabel: "Last sync 2026-03-29T12:00:00.000Z",
        }),
      ]),
    );
    expect(
      deriveControlGapStateFromEvidenceSyncState({
        ...healthy,
        sources: [
          healthy.sources[0],
          {
            ...healthy.sources[0],
            sourceId: "github:acme/older",
            repo: "acme/older",
            lastSyncedAt: "2026-03-29T12:00:00.000Z",
          },
        ],
      }).controls,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlId: "CC6.1",
          evidenceRecords: expect.arrayContaining([
            expect.objectContaining({
              updatedAt: "2026-03-29T12:20:00.000Z",
            }),
          ]),
        }),
      ]),
    );

    const existing = await loadOrCreateEvidenceSyncState("conv-resync");
    expect(existing.conversationId).toBe("conv-resync");
  });
});
