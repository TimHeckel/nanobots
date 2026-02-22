"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { LoadingDots } from "@/components/shared/loading-dots";
import { BotCard } from "./bot-card";
import { SwarmCard } from "./swarm-card";
import { ChatSidebar, type ConversationItem } from "./chat-sidebar";

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
  conversationId?: string;
}

function ChatSession({
  conversationId,
  initialMessages,
  bots,
  swarms,
  onConversationCreated,
}: {
  conversationId: string | null;
  initialMessages: UIMessage[];
  bots: BotInfo[];
  swarms: SwarmInfo[];
  onConversationCreated: (id: string, title: string) => void;
}) {
  const [localConvId, setLocalConvId] = useState(conversationId);

  const transport = useMemo(
    () => new DefaultChatTransport({ body: { conversationId: localConvId } }),
    [localConvId],
  );

  const { messages, sendMessage, status, error, regenerate, clearError } =
    useChat({
      id: localConvId ?? "new",
      messages: initialMessages.length > 0 ? initialMessages : undefined,
      transport,
      onError: (err) => {
        console.error("[chat] Stream error:", err);
      },
    });

  const isLoading = status === "submitted" || status === "streaming";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, status]);

  const handleSend = useCallback(
    async (text: string) => {
      let convId = localConvId;

      // Auto-create conversation on first message
      if (!convId) {
        try {
          const res = await fetch("/api/conversations", { method: "POST" });
          if (res.ok) {
            const { conversation } = await res.json();
            convId = conversation.id as string;
            setLocalConvId(convId);
            const title =
              text.length > 80
                ? text.slice(0, text.lastIndexOf(" ", 80) || 80)
                : text;
            onConversationCreated(convId, title);
          }
        } catch {
          // Fall through
        }
      }

      sendMessage({ text }, { body: { conversationId: convId } });
    },
    [sendMessage, localConvId, onConversationCreated],
  );

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center">
              <div className="font-mono text-2xl font-bold mb-2">
                <span className="text-brand">nano</span>
                <span className="text-foreground">bots</span>
                <span className="text-purple-accent">.sh</span>
              </div>
              <p className="text-foreground/30 text-sm max-w-md mb-6">
                Your AI-powered security and documentation assistant.
              </p>

              <div className="w-full max-w-lg mb-4">
                <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 font-mono text-left">
                  Bots
                </h3>
                {bots.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {bots.map((bot) => (
                      <BotCard key={bot.bot_name} name={bot.bot_name} enabled={bot.enabled} />
                    ))}
                  </div>
                ) : (
                  <p className="text-foreground/20 text-xs font-mono text-left">
                    No custom bots yet — ask me to create one
                  </p>
                )}
              </div>

              <div className="w-full max-w-lg mb-6">
                <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 font-mono text-left">
                  Swarms
                </h3>
                {swarms.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {swarms.map((swarm) => (
                      <SwarmCard key={swarm.name} name={swarm.name} description={swarm.description} botCount={swarm.botCount} />
                    ))}
                  </div>
                ) : (
                  <p className="text-foreground/20 text-xs font-mono text-left">
                    No swarms configured
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-3 max-w-lg">
                {["Run a security scan", "Create a bot", "Generate docs for my repo"].map((prompt) => (
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
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center">
                <span className="text-brand text-xs font-mono font-bold">n</span>
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-indigo-deep/80 px-4 py-3">
                <LoadingDots />
              </div>
            </div>
          )}

          {error && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <span className="text-red-400 text-xs font-mono font-bold">!</span>
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-red-500/10 border border-red-500/20 px-4 py-3">
                <p className="text-red-400 text-sm font-mono">
                  Stream failed — {error.message || "connection lost"}
                </p>
                <button
                  onClick={() => { clearError(); regenerate(); }}
                  className="mt-2 text-xs text-red-400/70 hover:text-red-400 underline font-mono"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}

export function ChatInterface({
  user,
  org,
  isPlatformAdmin,
  conversationId,
}: ChatInterfaceProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(!conversationId);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") return window.innerWidth >= 768;
    return false;
  });
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [swarms, setSwarms] = useState<SwarmInfo[]>([]);

  // Fetch conversations + context on mount
  useEffect(() => {
    fetch("/api/conversations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.conversations) setConversations(data.conversations);
      })
      .catch(() => {});

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

  // Load messages when conversationId is in the URL
  useEffect(() => {
    if (!conversationId) {
      setInitialMessages([]);
      setMessagesLoaded(true);
      return;
    }
    setMessagesLoaded(false);
    fetch(`/api/conversations/${conversationId}/messages`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setInitialMessages(data?.messages ?? []);
        setMessagesLoaded(true);
      })
      .catch(() => {
        setInitialMessages([]);
        setMessagesLoaded(true);
      });
  }, [conversationId]);

  const handleNewChat = useCallback(() => {
    router.push("/chat");
  }, [router]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setSidebarOpen(false);
      router.push(`/chat/${id}`);
    },
    [router],
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (conversationId === id) {
          router.push("/chat");
        }
      } catch {
        // Ignore
      }
    },
    [conversationId, router],
  );

  const handleConversationCreated = useCallback(
    (id: string, title: string) => {
      setConversations((prev) => [
        { id, title, updated_at: new Date().toISOString() },
        ...prev,
      ]);
      // Update URL without remounting (shallow)
      window.history.replaceState(null, "", `/chat/${id}`);
      // Update title on server
      fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }).catch(() => {});
    },
    [],
  );

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar
        conversations={conversations}
        activeId={conversationId ?? null}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onDelete={handleDeleteConversation}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader
          user={user}
          org={org}
          onLogout={handleLogout}
          isPlatformAdmin={isPlatformAdmin}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />

        {messagesLoaded ? (
          <ChatSession
            key={conversationId ?? "new"}
            conversationId={conversationId ?? null}
            initialMessages={initialMessages}
            bots={bots}
            swarms={swarms}
            onConversationCreated={handleConversationCreated}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <LoadingDots />
          </div>
        )}
      </div>
    </div>
  );
}
