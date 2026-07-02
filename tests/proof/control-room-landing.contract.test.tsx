import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("control room landing contract", () => {
  it("renders operator-control-room messaging instead of legacy bot swarm marketing", () => {
    const markup = renderToStaticMarkup(<Home />);

    expect(markup).toContain("Operator Control Room");
    expect(markup).toContain("Evidence Sources");
    expect(markup).toContain("Control Health");
    expect(markup).toContain("Sprinto");
    expect(markup).toContain("Connected Evidence Sources");
    expect(markup).toContain("Connect GitHub");
    expect(markup).toContain("Connect Screenshot Capture");
    expect(markup).toContain("Mapped Controls");
    expect(markup).toContain("Sprinto Control Mapping");
    expect(markup).toContain("Provable Middle");
    expect(markup).toContain("Monitoring Status");
    expect(markup).toContain("Exceptions");
    expect(markup).toContain("Sync Health");
    expect(markup).toContain("Resolve Evidence Gap");
    expect(markup).toContain("Missing Evidence");
    expect(markup).toContain("Next Recommended Action");
    expect(markup).toContain("Sprinto Export Status");
    expect(markup).toContain("Last Sprinto Sync");
    expect(markup).toContain("Update Sprinto");
    expect(markup).toContain("Awaiting evidence sources");
    expect(markup).toContain("No local export run");
    expect(markup).toContain("Connect a source first");
    expect(markup).toContain("Capture Screenshot Evidence");
    expect(markup).toContain("Capture Video Evidence");
    expect(markup).toContain("Media Evidence");
  });
});
