import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageBubble } from "@/components/chat/message-bubble";

describe("message bubble contract", () => {
  it("renders the minimal control-room message bubble preview", () => {
    const markup = renderToStaticMarkup(
      <MessageBubble message={{ role: "assistant" }} />,
    );

    expect(markup).toContain("Operator Control Room Message");
    expect(markup).toContain("assistant");
  });
});
