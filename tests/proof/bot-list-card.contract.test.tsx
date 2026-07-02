import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BotListCard } from "@/components/chat/tool-cards/bot-list-card";

describe("bot list card contract", () => {
  it("renders the minimal control-room bot list preview", () => {
    const markup = renderToStaticMarkup(
      <BotListCard result={{ bots: [{ name: "Evidence Bot" }] }} />,
    );

    expect(markup).toContain("Control Room Bot List");
    expect(markup).toContain("Evidence Bot");
    expect(markup).toContain("bots");
  });
});
