"use client";

import type { UIMessage } from "ai";
import { ToolResultRenderer } from "./tool-result-renderer";
import { MarkdownContent } from "./markdown-content";

interface MessageBubbleProps {
  message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  if (!isUser && !isAssistant) return null;

  // Extract text content from parts
  const textParts = message.parts.filter(
    (p): p is Extract<typeof p, { type: "text" }> => p.type === "text",
  );
  const textContent = textParts.map((p) => p.text).join("");

  // Extract tool invocation parts (both static and dynamic)
  const toolParts = message.parts.filter(
    (p) =>
      p.type === "dynamic-tool" ||
      (typeof p.type === "string" && p.type.startsWith("tool-")),
  );

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* Assistant avatar */}
      {isAssistant && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center mt-1">
          <span className="text-brand text-xs font-mono font-bold">n</span>
        </div>
      )}

      <div
        className={`max-w-[80%] md:max-w-[70%] space-y-3 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {/* Text content */}
        {textContent && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              isUser
                ? "bg-purple-accent/10 text-foreground rounded-br-sm"
                : "bg-indigo-deep/80 text-foreground/80 rounded-bl-sm"
            }`}
          >
            {isAssistant ? (
              <MarkdownContent content={textContent} />
            ) : (
              <div className="whitespace-pre-wrap break-words">{textContent}</div>
            )}
          </div>
        )}

        {/* Tool invocations */}
        {toolParts.map((part) => {
          // DynamicToolUIPart has toolName and toolCallId directly
          const toolPart = part as {
            type: string;
            toolName: string;
            toolCallId: string;
            state: string;
            output?: unknown;
            input?: unknown;
          };
          const toolName = toolPart.toolName;
          const toolCallId = toolPart.toolCallId;
          const hasOutput = toolPart.state === "output-available" && toolPart.output != null;

          return (
            <div key={toolCallId} className="w-full">
              {hasOutput ? (
                <ToolResultRenderer
                  toolName={toolName}
                  result={toolPart.output}
                />
              ) : (
                <div className="rounded-xl bg-indigo-deep/40 border border-purple-accent/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-accent pulse-dot" />
                    <span className="text-xs text-foreground/40 font-mono">
                      {toolName}...
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
