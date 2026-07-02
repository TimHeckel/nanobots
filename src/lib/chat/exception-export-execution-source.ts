import type { ExceptionExportStatusSource } from "@/lib/chat/control-room-state";
import { loadControlRoomExecutionSource } from "@/lib/chat/control-room-execution-source";

export type ExceptionExportExecutionRequest = {
  conversationId: string;
  text: string;
};

export async function loadExceptionExportExecutionSource(
  request: ExceptionExportExecutionRequest,
): Promise<ExceptionExportStatusSource> {
  return (
    await loadControlRoomExecutionSource({
      conversationId: request.conversationId,
      text: request.text,
    })
  ).exceptionExportSource;
}
