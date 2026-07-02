import { describe, expect, it } from "vitest";
import { getControlRoomContext } from "@/lib/chat/context";

describe("chat context contract", () => {
  it("returns stable control-room context data", async () => {
    await expect(getControlRoomContext()).resolves.toEqual({
      evidenceSources: ["GitHub", "Sprinto", "Browser Capture"],
      controlHealth: ["Needs review", "Healthy", "At risk"],
      sprintoStatus: "preview",
    });
  });
});
