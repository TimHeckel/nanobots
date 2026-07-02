import { describe, expect, it } from "vitest";
import { migrate, sql } from "@/lib/db";

describe("db contract", () => {
  it("keeps migration as a no-op placeholder", async () => {
    await expect(migrate()).resolves.toBeUndefined();
  });

  it("throws until the control-room database contract is implemented", async () => {
    await expect(sql`SELECT 1`).rejects.toThrow(
      "Control room database contract is not implemented yet.",
    );
  });
});
