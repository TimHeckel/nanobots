import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    surface: "operator-control-room-auth",
    message: "GitHub callback handling is not implemented yet.",
  });
}
