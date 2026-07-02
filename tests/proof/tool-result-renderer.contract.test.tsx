import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToolResultRenderer } from "@/components/chat/tool-result-renderer";

describe("tool result renderer contract", () => {
  it("renders the minimal control-room tool result preview", () => {
    const markup = renderToStaticMarkup(
      <ToolResultRenderer
        toolName="syncSprinto"
        result={{ status: "preview", controls: 2 }}
      />,
    );

    expect(markup).toContain("Control Room Tool Result");
    expect(markup).toContain("syncSprinto");
    expect(markup).toContain("preview");
    expect(markup).toContain("controls");
  });
});
