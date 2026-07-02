import { NextResponse } from "next/server";
import {
  buildSprintoControlEntities,
  type ScanEvidence,
} from "@/lib/compliance/sprinto";
import {
  recordSprintoExportBaseline,
  runSprintoMonitoringLoop,
} from "@/lib/compliance/monitoring";
import { loadSprintoControlBaselinesFromDb } from "@/lib/db/monitoring";

const PREVIEW_ORG_ID = "preview-org";
const PREVIEW_BASELINE_SYNCED_AT = "2026-03-26T09:15:00.000Z";
const PREVIEW_CHECKED_AT = "2026-03-29T12:00:00.000Z";

const previewExportScans: ScanEvidence[] = [
  {
    scanId: "preview_scan_clean",
    repo: "acme/api",
    startedAt: "2026-03-26T08:55:00.000Z",
    completedAt: "2026-03-26T09:15:00.000Z",
    durationMs: 1_200_000,
    totalFindings: 0,
    totalPrs: 0,
    botsRun: ["security-scanner", "actions-hardening"],
    botResults: {
      "security-scanner": {
        findingCount: 0,
        durationMs: 900_000,
      },
      "actions-hardening": {
        findingCount: 0,
        durationMs: 300_000,
      },
    },
    findingEvents: [],
    prUrls: [],
  },
];

const previewObservedScans: ScanEvidence[] = [
  {
    scanId: "preview_scan_clean",
    repo: "acme/api",
    startedAt: "2026-03-01T08:55:00.000Z",
    completedAt: "2026-03-01T09:15:00.000Z",
    durationMs: 1_200_000,
    totalFindings: 1,
    totalPrs: 0,
    botsRun: ["security-scanner", "actions-hardening"],
    botResults: {
      "security-scanner": {
        findingCount: 1,
        durationMs: 900_000,
      },
      "actions-hardening": {
        findingCount: 0,
        durationMs: 300_000,
      },
    },
    findingEvents: [
      {
        botName: "security-scanner",
        file: "src/release.ts",
        line: 88,
        severity: "high",
        category: "release",
        description: "Release approval screenshot is missing for CC8.1 evidence.",
      },
    ],
    prUrls: [],
  },
];

async function runPreviewMonitoringCycle() {
  const baselines = await loadSprintoControlBaselinesFromDb(PREVIEW_ORG_ID);
  if (baselines.length === 0) {
    await recordSprintoExportBaseline({
      orgId: PREVIEW_ORG_ID,
      entities: buildSprintoControlEntities(previewExportScans),
      syncedAt: PREVIEW_BASELINE_SYNCED_AT,
    });
  }

  const currentEntities = buildSprintoControlEntities(previewObservedScans);
  const result = await runSprintoMonitoringLoop({
    orgId: PREVIEW_ORG_ID,
    currentEntities,
    checkedAt: PREVIEW_CHECKED_AT,
  });

  return NextResponse.json({
    surface: "operator-control-room-monitoring",
    monitoringStatus: "active",
    controlFreshness: result.run.stale_controls > 0 ? "review-due" : "healthy",
    checkedControls: result.run.controls_checked,
    staleControls: result.run.stale_controls,
    openExceptions: result.run.open_exceptions,
    comparedBaselineControls: result.comparedBaselineControls,
    findings: result.findings,
  });
}

export async function GET() {
  return runPreviewMonitoringCycle();
}

export async function POST() {
  return runPreviewMonitoringCycle();
}
