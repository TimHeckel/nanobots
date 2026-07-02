import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DiffViewer } from "@/components/shared/diff-viewer";

describe("diff viewer contract", () => {
  it("renders the minimal control-room diff preview", () => {
    const markup = renderToStaticMarkup(
      <DiffViewer current="before" proposed="after" />,
    );

    expect(markup).toContain("Control Room Diff Preview");
    expect(markup).toContain("before");
    expect(markup).toContain("after");
  });
});
