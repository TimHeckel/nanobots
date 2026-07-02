import type { ControlRoomExecutionSource } from "@/lib/chat/control-room-state";
import {
  loadConversationControlRoomExecutionSource,
} from "@/lib/chat/conversation-thread-store";

export {
  QUEUED_CONTROL_ROOM_EXECUTION_SOURCE,
  QUEUED_EXCEPTION_EXPORT_EXECUTION_SOURCE,
  QUEUED_MONITORING_EXPORT_EXECUTION_SOURCE,
} from "@/lib/chat/control-room-execution-source-seed";

export type ControlRoomExecutionRequest = {
  conversationId: string;
  text: string;
};

export async function loadControlRoomExecutionSource(
  request: ControlRoomExecutionRequest,
): Promise<ControlRoomExecutionSource> {
  return loadConversationControlRoomExecutionSource(request.conversationId);
}
