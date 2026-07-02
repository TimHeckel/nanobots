import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SwarmCard } from "@/components/chat/swarm-card";

describe("swarm card contract", () => {
  it("renders the minimal control-room swarm card preview", () => {
    const markup = renderToStaticMarkup(<SwarmCard name="Evidence Swarm" />);

    expect(markup).toContain("Evidence Swarm");
    expect(markup).toContain("Control-room swarm cards are in preview mode.");
  });
});
