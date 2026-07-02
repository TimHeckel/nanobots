import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatHeader } from "@/components/chat/chat-header";

describe("chat header contract", () => {
  it("renders the minimal control-room chat header preview", () => {
    const markup = renderToStaticMarkup(
      <ChatHeader
        org={{ login: "nanobots" }}
        user={{ login: "operator" }}
      />,
    );

    expect(markup).toContain("Operator Control Room Header");
    expect(markup).toContain("nanobots");
    expect(markup).toContain("operator");
  });
});
