import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PromptEditor } from "@/components/admin/prompt-editor";

describe("prompt editor contract", () => {
  it("renders the minimal control-room prompt editor preview", () => {
    const markup = renderToStaticMarkup(
      <PromptEditor
        agentName="control-gap-agent"
        description="Explains the current evidence-gap remediation prompt."
      />,
    );

    expect(markup).toContain("control-gap-agent");
    expect(markup).toContain(
      "Explains the current evidence-gap remediation prompt.",
    );
    expect(markup).toContain("Prompt editing is in control-room preview mode.");
  });
});
