import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    prompts: [],
    surface: "operator-control-room-admin",
    message: "Prompt administration is not implemented yet.",
  });
}
