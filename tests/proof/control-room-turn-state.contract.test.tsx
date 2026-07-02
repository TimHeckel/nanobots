import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ControlRoomTurnStateProvider,
  ControlRoomNextRecommendedActionCard,
  useControlRoomTurnState,
  useOptionalControlRoomTurnState,
} from "@/components/control-room/control-room-turn-state";

describe("control room turn state contract", () => {
  it("renders the next recommended action card from the provider context", () => {
    const markup = renderToStaticMarkup(
      <ControlRoomTurnStateProvider initialNextRecommendedActionDetail="Attach the release approval screenshot.">
        <ControlRoomNextRecommendedActionCard />
      </ControlRoomTurnStateProvider>,
    );

    expect(markup).toContain("Next Recommended Action");
    expect(markup).toContain("Attach the release approval screenshot.");
  });

  it("throws when useControlRoomTurnState is called outside the provider", () => {
    function Orphan() {
      useControlRoomTurnState();
      return <div />;
    }

    expect(() => renderToStaticMarkup(<Orphan />)).toThrow(
      "useControlRoomTurnState must be used within the provider",
    );
  });

  it("returns null from useOptionalControlRoomTurnState outside the provider", () => {
    function Probe() {
      const value = useOptionalControlRoomTurnState();
      return <span>{value === null ? "ctx-null" : "ctx-present"}</span>;
    }

    const markup = renderToStaticMarkup(<Probe />);
    expect(markup).toContain("ctx-null");
  });
});
