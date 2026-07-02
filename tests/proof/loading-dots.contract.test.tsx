import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoadingDots } from "@/components/shared/loading-dots";

describe("loading dots contract", () => {
  it("renders the minimal control-room loading state", () => {
    const markup = renderToStaticMarkup(<LoadingDots />);

    expect(markup).toContain("Control Room Loading");
  });
});
