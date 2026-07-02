import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SwarmCard } from "@/components/chat/tool-cards/swarm-card";

describe("tool swarm card contract", () => {
  it("renders the minimal control-room swarm preview", () => {
    const markup = renderToStaticMarkup(
      <SwarmCard result={{ swarm: { name: "Evidence Swarm" } }} />,
    );

    expect(markup).toContain("Control Room Swarm Preview");
    expect(markup).toContain("Evidence Swarm");
    expect(markup).toContain("swarm");
  });
});
