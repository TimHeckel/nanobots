import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    surface: "operator-control-room-auth",
    message: "Logout flow is not implemented yet.",
  });
}
