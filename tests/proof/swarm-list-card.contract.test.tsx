import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SwarmListCard } from "@/components/chat/tool-cards/swarm-list-card";

describe("swarm list card contract", () => {
  it("renders the minimal control-room swarm list preview", () => {
    const markup = renderToStaticMarkup(
      <SwarmListCard result={{ swarms: [{ name: "Evidence Swarm" }] }} />,
    );

    expect(markup).toContain("Control Room Swarm List");
    expect(markup).toContain("Evidence Swarm");
    expect(markup).toContain("swarms");
  });
});
