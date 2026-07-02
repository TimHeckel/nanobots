import { describe, expect, it } from "vitest";
import { docStatusToolDef } from "@/lib/chat/tools/doc-status";

describe("doc status tool contract", () => {
  it("returns the minimal control-room documentation status", async () => {
    const tool = docStatusToolDef("org_1");
    const result = await tool.execute({ repoName: "acme/api" });

    expect(tool.description).toContain("documentation status");
    expect(result).toEqual({
      orgId: "org_1",
      repo: "acme/api",
      status: "preview",
      docs: [],
    });
  });
});
