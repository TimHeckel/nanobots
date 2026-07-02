import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/scan/route";

describe("scan route contract", () => {
  it("returns the minimal control-room scan payloads", async () => {
    const getResponse = await GET();
    const getPayload = await getResponse.json();

    expect(getPayload).toEqual({
      surface: "operator-control-room-scan",
      scanStatus: "queued",
      target: "github-evidence-refresh",
    });

    const postResponse = await POST();
    const postPayload = await postResponse.json();

    expect(postPayload).toEqual({
      surface: "operator-control-room-scan",
      scanStatus: "queued",
      target: "github-evidence-refresh",
    });
  });
});
