import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocGenerationCard } from "@/components/chat/tool-cards/doc-generation-card";

describe("doc generation card contract", () => {
  it("renders the minimal control-room documentation preview", () => {
    const markup = renderToStaticMarkup(
      <DocGenerationCard result={{ repo: "acme/api", prsCreated: 1 }} />,
    );

    expect(markup).toContain("Control Room Documentation Preview");
    expect(markup).toContain("acme/api");
    expect(markup).toContain("prsCreated");
  });
});
