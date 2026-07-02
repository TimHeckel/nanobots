import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout, { metadata } from "@/app/layout";

describe("root layout contract", () => {
  it("describes the operator control room metadata and wraps children", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <div>child</div>
      </RootLayout>,
    );

    expect(metadata.title).toBe("nanobots — Operator Control Room");
    expect(String(metadata.description)).toContain("Sprinto-first");
    expect(markup).toContain("child");
  });
});
