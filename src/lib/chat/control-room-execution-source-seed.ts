import type {
  ControlRoomExecutionSource,
  ExceptionExportStatusSource,
  MonitoringExportStatusSource,
} from "@/lib/chat/control-room-state";
import { loadExecutionSource, saveExecutionSource } from "@/lib/db/execution-source";

export const QUEUED_EXCEPTION_EXPORT_EXECUTION_SOURCE: ExceptionExportStatusSource =
  {
    browserCapturePhase: "queued",
    releaseVerificationPhase: "capture-queued",
  };

export const QUEUED_MONITORING_EXPORT_EXECUTION_SOURCE: MonitoringExportStatusSource =
  {
    phase: "evidence-refresh-queued",
    controlId: "CC8.1",
  };

export const QUEUED_CONTROL_ROOM_EXECUTION_SOURCE: ControlRoomExecutionSource = {
  exceptionExportSource: QUEUED_EXCEPTION_EXPORT_EXECUTION_SOURCE,
  monitoringExportStatusSource: QUEUED_MONITORING_EXPORT_EXECUTION_SOURCE,
};

export async function loadPersistedControlRoomExecutionSource(
  conversationId: string,
): Promise<ControlRoomExecutionSource | null> {
  return loadExecutionSource(conversationId);
}

export async function savePersistedControlRoomExecutionSource(
  conversationId: string,
  source: ControlRoomExecutionSource,
): Promise<void> {
  await saveExecutionSource(conversationId, source);
}