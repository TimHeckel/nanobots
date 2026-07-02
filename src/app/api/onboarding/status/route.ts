import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    surface: "operator-control-room-onboarding",
    onboardingStatus: "ready",
    nextStep: "Connect GitHub",
  });
}
