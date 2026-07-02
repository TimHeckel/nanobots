import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OnboardingPage from "@/app/onboarding/page";

describe("onboarding page contract", () => {
  it("renders the minimal control-room onboarding entry", () => {
    const markup = renderToStaticMarkup(<OnboardingPage />);

    expect(markup).toContain("Operator Control Room Onboarding");
    expect(markup).toContain(
      "Connect GitHub to begin collecting compliance evidence.",
    );
  });
});
