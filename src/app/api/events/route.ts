import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      surface: "operator-control-room-events",
      accepted: true,
      eventType: "evidence-refresh-requested",
    },
    { status: 202 },
  );
}
