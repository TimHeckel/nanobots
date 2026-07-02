import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    surface: "operator-control-room-auth",
    authenticated: true,
    user: {
      id: "operator-demo",
      name: "Control Room Operator",
      role: "compliance-operator",
    },
  });
}
