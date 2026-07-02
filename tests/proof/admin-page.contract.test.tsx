import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AdminPage from "@/app/admin/page";

describe("admin page contract", () => {
  it("renders the minimal operator control-room admin stub", () => {
    const markup = renderToStaticMarkup(<AdminPage />);

    expect(markup).toContain("Admin Surface");
    expect(markup).toContain("Operator Control Room Admin");
  });
});
