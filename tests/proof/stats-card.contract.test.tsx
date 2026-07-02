import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatsCard } from "@/components/chat/tool-cards/stats-card";

describe("stats card contract", () => {
  it("renders the minimal control-room stats preview", () => {
    const markup = renderToStaticMarkup(
      <StatsCard result={{ total_scans: 4, total_findings: 2 }} />,
    );

    expect(markup).toContain("Control Room Stats Preview");
    expect(markup).toContain("total_scans");
    expect(markup).toContain("total_findings");
  });
});
