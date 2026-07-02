import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SprintoPushClient,
  type SprintoControlEntity,
} from "@/lib/compliance/sprinto";

const originalFetch = global.fetch;

function makeEntity(id: string): SprintoControlEntity {
  return {
    external_id: id,
    repo: "acme/api",
    scan_id: "scan_1",
    control_key: "NB-CC-001",
    control_name: "Security scan executed on repository changes",
    suggested_soc2_mapping: "CC7.2 / CC8.1",
    status: "pass",
    finding_count: 0,
    highest_severity: "none",
    remediation_count: 0,
    bots_csv: "security-scanner",
    remediation_urls_csv: "",
    scan_started_at: "2026-03-23T12:00:00.000Z",
    scan_completed_at: "2026-03-23T12:00:03.000Z",
    summary: "Repository acme/api passed.",
    evidence_markdown: "# Evidence",
    sample_findings_json: "[]",
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("SprintoPushClient", () => {
  it("creates a session, pushes entity pages, and closes the session", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session_id: "session_123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accepted: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            integration_id: "int_123",
            sessions: {
              active: 0,
              processing: 1,
              processed: 0,
              failed: 0,
              expired: 0,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    global.fetch = fetchMock as typeof fetch;

    const client = new SprintoPushClient({
      apiKey: "sprinto_api_key",
      baseUrl: "https://api.sprinto.test/api/external/push",
    });

    const result = await client.syncEngineeringControls({
      integrationId: "int_123",
      entities: [makeEntity("control_1")],
    });

    expect(result.sessionId).toBe("session_123");
    expect(result.pushedPages).toBe(1);
    expect(result.pushedEntities).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.sprinto.test/api/external/push/v1/integrations/int_123/sessions",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.sprinto.test/api/external/push/v1/integrations/int_123/sessions/session_123/entities",
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://api.sprinto.test/api/external/push/v1/integrations/int_123/sessions/session_123/close",
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      "https://api.sprinto.test/api/external/push/v1/integrations/int_123/status",
    );
  });
});
