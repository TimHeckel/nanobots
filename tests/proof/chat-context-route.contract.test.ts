import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/chat/context/route";

describe("chat context route contract", () => {
  it("returns the minimal control-room conversation context payload", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload).toEqual({
      surface: "operator-control-room",
      conversationContext: {
        evidenceSources: ["GitHub", "Screenshot Capture"],
        missingEvidence: ["Incident response walkthrough recording"],
        nextRecommendedAction: "Resolve Evidence Gap",
      },
    });
  });
});
