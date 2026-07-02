import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WebhookListCard } from "@/components/chat/tool-cards/webhook-list-card";

describe("webhook list card contract", () => {
  it("renders the minimal control-room webhook list preview", () => {
    const markup = renderToStaticMarkup(
      <WebhookListCard result={{ webhooks: [{ id: "wh_1" }] }} />,
    );

    expect(markup).toContain("Control Room Webhook List");
    expect(markup).toContain("wh_1");
    expect(markup).toContain("webhooks");
  });
});
