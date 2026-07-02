import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScanResultsCard } from "@/components/chat/tool-cards/scan-results-card";

describe("scan results card contract", () => {
  it("renders the minimal control-room scan results preview", () => {
    const markup = renderToStaticMarkup(
      <ScanResultsCard result={{ repo: "acme/api", total_findings: 2 }} />,
    );

    expect(markup).toContain("Control Room Scan Results");
    expect(markup).toContain("acme/api");
    expect(markup).toContain("total_findings");
  });
});
