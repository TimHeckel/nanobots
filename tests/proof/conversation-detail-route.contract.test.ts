import { describe, expect, it } from "vitest";
import { DELETE, PATCH } from "@/app/api/conversations/[id]/route";

describe("conversation detail route contract", () => {
  it("returns the minimal control-room conversation detail payloads", async () => {
    const patchResponse = await PATCH(new Request("http://localhost"), {
      params: Promise.resolve({ id: "conv-control-gap" }),
    });
    const patchPayload = await patchResponse.json();

    expect(patchPayload).toEqual({
      surface: "operator-control-room",
      conversation: {
        id: "conv-control-gap",
        title: "Resolve access review evidence gap",
        status: "active",
      },
    });

    const deleteResponse = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "conv-control-gap" }),
    });
    const deletePayload = await deleteResponse.json();

    expect(deletePayload).toEqual({
      surface: "operator-control-room",
      archivedConversationId: "conv-control-gap",
    });
  });
});
