import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProposalCard } from "@/components/chat/tool-cards/proposal-card";

describe("proposal card contract", () => {
  it("renders the minimal control-room proposal preview", () => {
    const markup = renderToStaticMarkup(
      <ProposalCard result={{ agent_name: "Roscoe", severity: "high" }} />,
    );

    expect(markup).toContain("Control Room Proposal Preview");
    expect(markup).toContain("Roscoe");
    expect(markup).toContain("severity");
  });
});
