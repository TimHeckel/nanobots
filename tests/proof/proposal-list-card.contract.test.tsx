import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProposalListCard } from "@/components/chat/tool-cards/proposal-list-card";

describe("proposal list card contract", () => {
  it("renders the minimal control-room proposal list preview", () => {
    const markup = renderToStaticMarkup(
      <ProposalListCard result={{ proposals: [{ id: "prop_1" }] }} />,
    );

    expect(markup).toContain("Control Room Proposal List");
    expect(markup).toContain("prop_1");
    expect(markup).toContain("proposals");
  });
});
