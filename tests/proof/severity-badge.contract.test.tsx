import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeverityBadge } from "@/components/shared/severity-badge";

describe("severity badge contract", () => {
  it("renders the minimal control-room severity label", () => {
    const markup = renderToStaticMarkup(<SeverityBadge severity="high" />);

    expect(markup).toContain("high");
  });
});
