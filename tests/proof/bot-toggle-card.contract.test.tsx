import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BotToggleCard } from "@/components/chat/tool-cards/bot-toggle-card";

describe("bot toggle card contract", () => {
  it("renders the minimal control-room bot toggle preview", () => {
    const markup = renderToStaticMarkup(
      <BotToggleCard result={{ botName: "Evidence Bot", enabled: false }} />,
    );

    expect(markup).toContain("Control Room Bot Toggle");
    expect(markup).toContain("Evidence Bot");
    expect(markup).toContain("enabled");
  });
});
