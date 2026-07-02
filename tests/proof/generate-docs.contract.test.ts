import { describe, expect, it } from "vitest";
import { generateDocsToolDef } from "@/lib/chat/tools/generate-docs";

describe("generate docs tool contract", () => {
  it("returns the minimal control-room documentation draft result", async () => {
    const tool = generateDocsToolDef("org_1", "user_1");

    expect(tool.description).toContain("control-room documentation draft");

    await expect(
      tool.execute({
        repoName: "acme/api",
      })
    ).resolves.toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      repo: "acme/api",
      docType: "all",
      status: "draft",
      message: "Prepared all documentation for acme/api.",
    });

    await expect(
      tool.execute({
        repoName: "acme/api",
        docType: "architecture",
      })
    ).resolves.toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      repo: "acme/api",
      docType: "architecture",
      status: "draft",
      message: "Prepared architecture documentation for acme/api.",
    });
  });
});
