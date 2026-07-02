import { NextResponse } from "next/server";

const scanSnapshot = {
  surface: "operator-control-room-scan",
  scanStatus: "queued",
  target: "github-evidence-refresh",
};

export async function GET() {
  return NextResponse.json(scanSnapshot);
}

export async function POST() {
  return NextResponse.json(scanSnapshot);
}
