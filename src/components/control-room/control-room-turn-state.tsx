"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

type ControlRoomTurnStateValue = {
  nextRecommendedActionDetail: string;
  setNextRecommendedActionDetail: (detail: string) => void;
};

const ControlRoomTurnStateContext =
  createContext<ControlRoomTurnStateValue | null>(null);

export function ControlRoomTurnStateProvider({
  children,
  initialNextRecommendedActionDetail,
}: {
  children: ReactNode;
  initialNextRecommendedActionDetail: string;
}) {
  const [nextRecommendedActionDetail, setNextRecommendedActionDetail] =
    useState(initialNextRecommendedActionDetail);

  return (
    <ControlRoomTurnStateContext.Provider
      value={{
        nextRecommendedActionDetail,
        setNextRecommendedActionDetail,
      }}
    >
      {children}
    </ControlRoomTurnStateContext.Provider>
  );
}

export function useControlRoomTurnState() {
  const context = useContext(ControlRoomTurnStateContext);

  if (!context) {
    throw new Error("useControlRoomTurnState must be used within the provider");
  }

  return context;
}

export function useOptionalControlRoomTurnState() {
  return useContext(ControlRoomTurnStateContext);
}

export function ControlRoomNextRecommendedActionCard() {
  const { nextRecommendedActionDetail } = useControlRoomTurnState();

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
        Next Recommended Action
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        {nextRecommendedActionDetail}
      </p>
    </div>
  );
}
