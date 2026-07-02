import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ChatLayout from "@/app/chat/layout";

describe("chat layout contract", () => {
  it("renders children through the minimal control-room chat layout", () => {
    const markup = renderToStaticMarkup(
      <ChatLayout>
        <div>chat-layout-child</div>
      </ChatLayout>,
    );

    expect(markup).toContain("chat-layout-child");
  });
});
