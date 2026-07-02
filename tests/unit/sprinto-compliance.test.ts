import { describe, expect, it } from "vitest";
import type { ActivityLogEntry } from "@/lib/db/schema";
import {
  buildScansFromActivity,
  buildSprintoControlEntities,
} from "@/lib/compliance/sprinto";

function makeActivityEntry(
  eventType: string,
  metadata: Record<string, unknown>,
  createdAt: string,
): ActivityLogEntry {
  return {
    id: `${eventType}-${createdAt}`,
    org_id: "org_123",
    event_type: eventType,
    summary: eventType,
    metadata,
    actor_id: null,
    created_at: new Date(createdAt),
  };
}

describe("buildScansFromActivity", () => {
  it("groups activity events into scan evidence", () => {
    const activity = [
      makeActivityEntry(
        "scan.started",
        {
          scanId: "scan_1",
          repo: "acme/api",
          timestamp: "2026-03-23T12:00:00.000Z",
        },
        "2026-03-23T12:00:00.000Z",
      ),
      makeActivityEntry(
        "bot.finding",
        {
          scanId: "scan_1",
          botName: "security-scanner",
          timestamp: "2026-03-23T12:00:02.000Z",
          finding: {
            file: "src/auth.ts",
            line: 42,
            severity: "high",
            category: "auth",
            description: "Missing authorization check",
          },
        },
        "2026-03-23T12:00:02.000Z",
      ),
      makeActivityEntry(
        "pr.created",
        {
          scanId: "scan_1",
          botName: "security-scanner",
          prUrl: "https://github.com/acme/api/pull/12",
          repo: "acme/api",
        },
        "2026-03-23T12:00:03.000Z",
      ),
      makeActivityEntry(
        "scan.completed",
        {
          scanId: "scan_1",
          repo: "acme/api",
          timestamp: "2026-03-23T12:00:04.000Z",
          botsRun: ["security-scanner", "actions-hardening"],
          findings: [
            {
              bot: "security-scanner",
              findingCount: 1,
              prUrl: "https://github.com/acme/api/pull/12",
            },
            {
              bot: "actions-hardening",
              findingCount: 0,
            },
          ],
          totalFindings: 1,
          totalPrs: 1,
          durationMs: 4000,
        },
        "2026-03-23T12:00:04.000Z",
      ),
    ];

    const scans = buildScansFromActivity(activity);

    expect(scans).toHaveLength(1);
    expect(scans[0]).toMatchObject({
      scanId: "scan_1",
      repo: "acme/api",
      totalFindings: 1,
      totalPrs: 1,
      botsRun: ["security-scanner", "actions-hardening"],
      prUrls: ["https://github.com/acme/api/pull/12"],
    });
    expect(scans[0].findingEvents).toHaveLength(1);
  });
});

describe("buildSprintoControlEntities", () => {
  it("maps scan evidence into control entities with pass/fail status", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry(
        "scan.started",
        {
          scanId: "scan_2",
          repo: "acme/web",
          timestamp: "2026-03-23T13:00:00.000Z",
        },
        "2026-03-23T13:00:00.000Z",
      ),
      makeActivityEntry(
        "bot.completed",
        {
          scanId: "scan_2",
          botName: "security-scanner",
          findingCount: 0,
          durationMs: 500,
        },
        "2026-03-23T13:00:01.000Z",
      ),
      makeActivityEntry(
        "bot.completed",
        {
          scanId: "scan_2",
          botName: "actions-hardening",
          findingCount: 0,
          durationMs: 300,
        },
        "2026-03-23T13:00:02.000Z",
      ),
      makeActivityEntry(
        "scan.completed",
        {
          scanId: "scan_2",
          repo: "acme/web",
          timestamp: "2026-03-23T13:00:03.000Z",
          botsRun: ["security-scanner", "actions-hardening"],
          findings: [],
          totalFindings: 0,
          totalPrs: 0,
          durationMs: 3000,
        },
        "2026-03-23T13:00:03.000Z",
      ),
    ]);

    const entities = buildSprintoControlEntities(scans);
    const securityControl = entities.find(
      (entity) => entity.control_key === "NB-CC-002",
    );
    const workflowControl = entities.find(
      (entity) => entity.control_key === "NB-CC-003",
    );

    expect(entities).toHaveLength(4);
    expect(securityControl?.status).toBe("pass");
    expect(workflowControl?.status).toBe("pass");
  });
});
