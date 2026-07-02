import { NextResponse } from "next/server";

const conversations = [
  {
    id: "conv-control-gap",
    title: "Resolve access review evidence gap",
    status: "active",
  },
];

export async function GET() {
  return NextResponse.json({ surface: "operator-control-room", conversations });
}

export async function POST() {
  return NextResponse.json(
    {
      surface: "operator-control-room",
      conversation: conversations[0],
    },
    { status: 201 },
  );
}
