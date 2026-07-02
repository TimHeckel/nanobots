import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    surface: "operator-control-room-auth",
    message: "GitHub connection flow is not implemented yet.",
  });
}
