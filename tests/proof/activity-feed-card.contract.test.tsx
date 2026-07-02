import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityFeedCard } from "@/components/chat/tool-cards/activity-feed-card";

describe("activity feed card contract", () => {
  it("renders the minimal control-room activity feed preview", () => {
    const markup = renderToStaticMarkup(
      <ActivityFeedCard
        result={{ event: "evidence.sync", status: "preview" }}
      />,
    );

    expect(markup).toContain("Control Room Activity Feed");
    expect(markup).toContain("evidence.sync");
    expect(markup).toContain("preview");
  });
});
