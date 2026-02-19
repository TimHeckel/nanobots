"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { LoadingDots } from "@/components/shared/loading-dots";
import { BotCard } from "./bot-card";
import { SwarmCard } from "./swarm-card";

interface BotInfo {
  bot_name: string;
  enabled: boolean;
}

interface SwarmInfo {
  name: string;
  description: string | null;
  botCount: number;
  bots: string[];
}

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
  isPlatformAdmin?: boolean;
}

export function ChatInterface({ user, org, isPlatformAdmin }: ChatInterfaceProps) {
  const { messages, sendMessage, status } = useChat();

  const isLoading = status === "submitted" || status === "streaming";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [swarms, setSwarms] = useState<SwarmInfo[]>([]);

  useEffect(() => {
    fetch("/api/chat/context")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setBots(data.bots ?? []);
          setSwarms(data.swarms ?? []);
        }
      })
      .catch(() => {});
  }, []);

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
      <ChatHeader user={user} org={org} onLogout={handleLogout} isPlatformAdmin={isPlatformAdmin} />

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
              <p className="text-foreground/30 text-sm max-w-md mb-6">
                Your AI-powered security and documentation assistant.
              </p>

              {/* Bots section */}
              <div className="w-full max-w-lg mb-4">
                <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 font-mono text-left">
                  Bots
                </h3>
                {bots.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {bots.map((bot) => (
                      <BotCard
                        key={bot.bot_name}
                        name={bot.bot_name}
                        enabled={bot.enabled}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-foreground/20 text-xs font-mono text-left">
                    No custom bots yet — ask me to create one
                  </p>
                )}
              </div>

              {/* Swarms section */}
              <div className="w-full max-w-lg mb-6">
                <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 font-mono text-left">
                  Swarms
                </h3>
                {swarms.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {swarms.map((swarm) => (
                      <SwarmCard
                        key={swarm.name}
                        name={swarm.name}
                        description={swarm.description}
                        botCount={swarm.botCount}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-foreground/20 text-xs font-mono text-left">
                    No swarms configured
                  </p>
                )}
              </div>

              {/* Starter prompts */}
              <div className="flex flex-wrap justify-center gap-3 max-w-lg">
                {[
                  "Run a security scan",
                  "Create a bot",
                  "Generate docs for my repo",
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
