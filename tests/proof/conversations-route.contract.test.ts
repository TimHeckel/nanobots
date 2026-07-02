import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/conversations/route";

describe("conversations route contract", () => {
  it("returns the minimal control-room conversations payloads", async () => {
    const getResponse = await GET();
    const getPayload = await getResponse.json();

    expect(getPayload).toEqual({
      surface: "operator-control-room",
      conversations: [
        {
          id: "conv-control-gap",
          title: "Resolve access review evidence gap",
          status: "active",
        },
      ],
    });

    const postResponse = await POST();
    const postPayload = await postResponse.json();

    expect(postResponse.status).toBe(201);
    expect(postPayload).toEqual({
      surface: "operator-control-room",
      conversation: {
        id: "conv-control-gap",
        title: "Resolve access review evidence gap",
        status: "active",
      },
    });
  });
});
