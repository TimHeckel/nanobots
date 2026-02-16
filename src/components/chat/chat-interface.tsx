"use client";

import { useEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { LoadingDots } from "@/components/shared/loading-dots";

interface ChatInterfaceProps {
  user: {
    id: string;
    name: string | null;
    login: string;
    avatarUrl: string | null;
  };
  org: {
    id: string;
    name: string | null;
    login: string;
    avatarUrl: string | null;
  };
}

export function ChatInterface({ user, org }: ChatInterfaceProps) {
  const { messages, sendMessage, status } = useChat();

  const isLoading = status === "submitted" || status === "streaming";
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, status]);

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  const handleSend = useCallback(
    (text: string) => {
      sendMessage({ text });
    },
    [sendMessage],
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <ChatHeader user={user} org={org} onLogout={handleLogout} />

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-6"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center">
              <div className="font-mono text-2xl font-bold mb-2">
                <span className="text-green-neon">nano</span>
                <span className="text-foreground">bots</span>
                <span className="text-purple-accent">.sh</span>
              </div>
              <p className="text-foreground/30 text-sm max-w-md mb-8">
                Your AI-powered security and documentation assistant. Try one of these to get started:
              </p>
              <div className="flex flex-wrap justify-center gap-3 max-w-lg">
                {[
                  `Scan my repos for security issues`,
                  `Generate documentation for my repo`,
                  `Show me which bots are active`,
                  `What can you do?`,
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="px-4 py-2 rounded-lg border border-purple-accent/20 bg-indigo-deep/40 text-sm text-foreground/60 hover:text-foreground/90 hover:border-purple-accent/40 hover:bg-indigo-deep/60 transition-all font-mono"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-neon/15 border border-green-neon/30 flex items-center justify-center">
                <span className="text-green-neon text-xs font-mono font-bold">
                  n
                </span>
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-indigo-deep/80 px-4 py-3">
                <LoadingDots />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}
