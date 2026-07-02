import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ChatPageInner from "@/app/chat/_chat-page";

describe("chat page contract", () => {
  it("renders the live control-room shell on the chat route", () => {
    const markup = renderToStaticMarkup(
      <ChatPageInner conversationId="conv-control-gap" />,
    );

    expect(markup).toContain("Operator Control Room");
    expect(markup).toContain("Evidence Sources");
    expect(markup).toContain("Sprinto Export Status");
  });
});
