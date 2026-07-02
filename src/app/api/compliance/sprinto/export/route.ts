import { NextResponse } from "next/server";

import {
  buildSprintoControlEntities,
  SprintoPushClient,
  type ScanEvidence,
} from "@/lib/compliance/sprinto";
import { recordSprintoExportBaseline } from "@/lib/compliance/monitoring";

const PREVIEW_INTEGRATION_ID = "preview-integration";
const PREVIEW_ENTITY_TYPE = "engineering_controls";
const PREVIEW_PAGE_HINT = "page-1";
const PREVIEW_ORG_ID = "preview-org";

const previewScans: ScanEvidence[] = [
  {
    scanId: "preview_scan_1",
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

export async function POST() {
  const entities = buildSprintoControlEntities(previewScans);
  const client = new SprintoPushClient({
    apiKey: "preview-sprinto-key",
    baseUrl: "https://sprinto.test",
  });

  let sessionId: string | undefined;

  try {
    sessionId = await client.createSession(PREVIEW_INTEGRATION_ID);
    const pushResponse = await client.pushEntityPage(
      PREVIEW_INTEGRATION_ID,
      sessionId,
      PREVIEW_ENTITY_TYPE,
      entities,
      PREVIEW_PAGE_HINT,
    );
    const closeResponse = await client.closeSession(
      PREVIEW_INTEGRATION_ID,
      sessionId,
      "apply",
    );
    await recordSprintoExportBaseline({
      orgId: PREVIEW_ORG_ID,
      entities,
    });

    return NextResponse.json({
      surface: "operator-control-room-sprinto",
      syncStatus: "succeeded",
      sessionId,
      pushedEntities: entities.length,
      pushResponse,
      closeResponse,
    });
  } catch (error) {
    return NextResponse.json(
      {
        surface: "operator-control-room-sprinto",
        syncStatus: "failed",
        sessionId: sessionId ?? null,
        pushedEntities: entities.length,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Sprinto export failure",
      },
      { status: 502 },
    );
  }
}
