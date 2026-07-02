import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ChatConversationPage from "@/app/chat/[id]/page";

describe("chat conversation page contract", () => {
  it("renders the live control-room shell on a conversation route", async () => {
    const page = await ChatConversationPage({
      params: Promise.resolve({ id: "conv-control-gap" }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain("Operator Control Room");
    expect(markup).toContain("Conversation Thread");
    expect(markup).toContain("Sprinto Export Status");
  });
});
