import type { BotFinding } from "./types";

export type BotEvent =
  | {
      type: "scan.started";
      timestamp: string;
      scanId: string;
      botCount: number;
      fileCount: number;
      repo: string;
    }
  | {
      type: "scan.completed";
      timestamp: string;
      scanId: string;
      totalFindings: number;
      durationMs: number;
    }
  | {
      type: "bot.started";
      timestamp: string;
      scanId: string;
      botName: string;
      fileCount: number;
      batchCount: number;
    }
  | {
      type: "bot.completed";
      timestamp: string;
      scanId: string;
      botName: string;
      findingCount: number;
      durationMs: number;
    }
  | {
      type: "bot.error";
      timestamp: string;
      scanId: string;
      botName: string;
      error: string;
      batchIndex: number;
    }
  | {
      type: "bot.finding";
      timestamp: string;
      scanId: string;
      botName: string;
      finding: BotFinding;
    }
  | {
      type: "pr.created";
      timestamp: string;
      scanId: string;
      botName: string;
      prUrl: string;
      repo: string;
    };

export type BotEventCallback = (event: BotEvent) => void | Promise<void>;

export function withScanId(
  scanId: string,
  cb: BotEventCallback,
): BotEventCallback {
  return (event) => cb({ ...event, scanId });
}
