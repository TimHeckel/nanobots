import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

describe("chat sidebar contract", () => {
  it("renders the minimal control-room chat sidebar preview", () => {
    const markup = renderToStaticMarkup(
      <ChatSidebar
        conversations={[
          {
            id: "conv-control-gap",
            title: "Resolve access review evidence gap",
            updated_at: "2026-03-26T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(markup).toContain("Operator Control Room Sidebar");
    expect(markup).toContain("1 conversations");
  });
});
