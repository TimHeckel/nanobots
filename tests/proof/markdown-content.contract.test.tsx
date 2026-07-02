import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "@/components/chat/markdown-content";

describe("markdown content contract", () => {
  it("renders the minimal control-room markdown preview", () => {
    const markup = renderToStaticMarkup(
      <MarkdownContent content="Missing evidence summary" />,
    );

    expect(markup).toContain("Missing evidence summary");
    expect(markup).toContain("Control-room markdown rendering is in preview mode.");
  });
});
