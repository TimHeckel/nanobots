import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      surface: "operator-control-room-github-webhook",
      accepted: true,
      eventType: "github-evidence-sync",
    },
    { status: 202 },
  );
}
