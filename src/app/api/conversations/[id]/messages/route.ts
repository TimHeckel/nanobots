import { NextResponse } from "next/server";
import { buildConversationThreadState } from "@/lib/chat/conversation-thread-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const threadState = await buildConversationThreadState(id);

  return NextResponse.json({
    surface: "operator-control-room",
    conversationId: id,
    messages: threadState.messages,
    controlRoomState: threadState.controlRoomState,
    ...(threadState.syncPanelState
      ? {
          syncPanelState: threadState.syncPanelState,
        }
      : {}),
  });
}
