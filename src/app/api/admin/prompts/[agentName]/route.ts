import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ agentName: string }> },
) {
  const { agentName } = await context.params;

  return NextResponse.json({
    agentName,
    surface: "operator-control-room-admin",
    message: "Per-agent prompt administration is not implemented yet.",
  });
}
