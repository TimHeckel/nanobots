import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "@/components/chat/chat-input";

describe("chat input contract", () => {
  it("renders the minimal control-room chat input preview", () => {
    const markup = renderToStaticMarkup(
      <ChatInput
        onSend={vi.fn()}
        isLoading={false}
      />,
    );

    expect(markup).toContain("Operator Control Room Input");
    expect(markup).toContain("Conversation input is in preview mode.");
  });
});
