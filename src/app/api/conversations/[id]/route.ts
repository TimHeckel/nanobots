import { NextResponse } from "next/server";

function getConversation(id: string) {
  return {
    id,
    title: "Resolve access review evidence gap",
    status: "active",
  };
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return NextResponse.json({
    surface: "operator-control-room",
    conversation: getConversation(id),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return NextResponse.json({
    surface: "operator-control-room",
    archivedConversationId: id,
  });
}
