import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/compliance/sprinto/export/route";
import { SprintoPushClient } from "@/lib/compliance/sprinto";
import {
  loadSprintoControlBaselinesFromDb,
  resetSprintoMonitoringStore,
} from "@/lib/db/monitoring";

describe("sprinto export route contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetSprintoMonitoringStore();
  });

  it("builds sprinto entities and pushes them through the sprinto client", async () => {
    const createSession = vi
      .spyOn(SprintoPushClient.prototype, "createSession")
      .mockResolvedValue("session_1");
    const pushEntityPage = vi
      .spyOn(SprintoPushClient.prototype, "pushEntityPage")
      .mockResolvedValue({ accepted: true });
    const closeSession = vi
      .spyOn(SprintoPushClient.prototype, "closeSession")
      .mockResolvedValue({ closed: true });

    const response = await POST();
    const payload = await response.json();

    expect(createSession).toHaveBeenCalledWith("preview-integration");
    expect(pushEntityPage).toHaveBeenCalledTimes(1);
    expect(pushEntityPage).toHaveBeenCalledWith(
      "preview-integration",
      "session_1",
      "engineering_controls",
      expect.arrayContaining([
        expect.objectContaining({
          scan_id: "preview_scan_1",
          repo: "acme/api",
          control_key: "NB-CC-001",
          sprinto_export_state: "ready",
        }),
        expect.objectContaining({
          control_key: "NB-CC-002",
          sprinto_export_state: "ready",
        }),
        expect.objectContaining({
          control_key: "NB-CC-003",
          sprinto_export_state: "ready",
        }),
        expect.objectContaining({
          control_key: "NB-CC-004",
          sprinto_export_state: "ready",
        }),
      ]),
      "page-1",
    );
    expect(closeSession).toHaveBeenCalledWith(
      "preview-integration",
      "session_1",
      "apply",
    );

    expect(payload).toEqual({
      surface: "operator-control-room-sprinto",
      syncStatus: "succeeded",
      sessionId: "session_1",
      pushedEntities: 4,
      pushResponse: { accepted: true },
      closeResponse: { closed: true },
    });

    await expect(loadSprintoControlBaselinesFromDb("preview-org")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          external_id: "preview_scan_1:NB-CC-001",
          control_key: "NB-CC-001",
          repo: "acme/api",
        }),
      ]),
    );
  });

  it("returns an auditable failure payload when sprinto rejects the push", async () => {
    vi.spyOn(SprintoPushClient.prototype, "createSession").mockResolvedValue(
      "session_2",
    );
    vi.spyOn(SprintoPushClient.prototype, "pushEntityPage").mockRejectedValue(
      new Error("Sprinto API request failed (422): push rejected"),
    );
    const closeSession = vi.spyOn(
      SprintoPushClient.prototype,
      "closeSession",
    );

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(closeSession).not.toHaveBeenCalled();
    expect(payload).toEqual({
      surface: "operator-control-room-sprinto",
      syncStatus: "failed",
      sessionId: "session_2",
      pushedEntities: 4,
      error: "Sprinto API request failed (422): push rejected",
    });
  });

  it("returns a null session id when the export fails before sprinto creates a session", async () => {
    vi.spyOn(SprintoPushClient.prototype, "createSession").mockRejectedValue(
      new Error("Sprinto session response did not include a session id"),
    );

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({
      surface: "operator-control-room-sprinto",
      syncStatus: "failed",
      sessionId: null,
      pushedEntities: 4,
      error: "Sprinto session response did not include a session id",
    });
  });

  it("falls back to an unknown export failure message when a non-error value is thrown", async () => {
    vi.spyOn(SprintoPushClient.prototype, "createSession").mockRejectedValue(
      "unexpected failure shape",
    );

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({
      surface: "operator-control-room-sprinto",
      syncStatus: "failed",
      sessionId: null,
      pushedEntities: 4,
      error: "Unknown Sprinto export failure",
    });
  });
});
