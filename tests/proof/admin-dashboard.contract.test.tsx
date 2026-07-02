import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

describe("admin dashboard contract", () => {
  it("renders the minimal control-room admin dashboard preview", () => {
    const markup = renderToStaticMarkup(<AdminDashboard />);

    expect(markup).toContain("Control Room Admin Dashboard");
    expect(markup).toContain(
      "Prompt administration is in control-room preview mode.",
    );
  });
});
