import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ChatPage from "@/app/chat/page";

describe("chat entry page contract", () => {
  it("renders the live control-room shell on the chat entry route", () => {
    const markup = renderToStaticMarkup(<ChatPage />);

    expect(markup).toContain("Operator Control Room");
    expect(markup).toContain("Control Health");
    expect(markup).toContain("Sprinto Export Status");
  });
});
