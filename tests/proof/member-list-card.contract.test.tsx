import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemberListCard } from "@/components/chat/tool-cards/member-list-card";

describe("member list card contract", () => {
  it("renders the minimal control-room member list preview", () => {
    const markup = renderToStaticMarkup(
      <MemberListCard result={{ members: [{ login: "operator" }] }} />,
    );

    expect(markup).toContain("Control Room Member List");
    expect(markup).toContain("operator");
    expect(markup).toContain("members");
  });
});
