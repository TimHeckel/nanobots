import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BotCard } from "@/components/chat/bot-card";

describe("bot card contract", () => {
  it("renders the minimal control-room bot card preview", () => {
    const markup = renderToStaticMarkup(<BotCard name="Evidence Bot" />);

    expect(markup).toContain("Evidence Bot");
    expect(markup).toContain("Control-room bot cards are in preview mode.");
  });
});
