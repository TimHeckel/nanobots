"use client";

import { useRef, useEffect } from "react";

export interface ConversationItem {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatSidebarProps {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

function groupConversations(conversations: ConversationItem[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: ConversationItem[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 Days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const conv of conversations) {
    const d = new Date(conv.updated_at);
    if (d >= today) groups[0].items.push(conv);
    else if (d >= yesterday) groups[1].items.push(conv);
    else if (d >= weekAgo) groups[2].items.push(conv);
    else groups[3].items.push(conv);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  isOpen,
  onToggle,
}: ChatSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close on outside click (mobile)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onToggle]);

  const groups = groupConversations(conversations);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`
          fixed md:relative z-50 md:z-auto
          top-0 left-0 h-full
          w-72 bg-background border-r border-purple-accent/10
          flex flex-col
          transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full md:hidden"}
        `}
      >
        {/* New Chat button */}
        <div className="flex-shrink-0 p-3 border-b border-purple-accent/10">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-brand/30 bg-brand/5 text-brand text-sm font-mono hover:bg-brand/10 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2">
          {groups.length === 0 && (
            <p className="text-xs text-foreground/20 font-mono px-4 py-8 text-center">
              No conversations yet
            </p>
          )}
          {groups.map((group) => (
            <div key={group.label} className="mb-2">
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-semibold text-foreground/30 uppercase tracking-wider font-mono">
                  {group.label}
                </span>
              </div>
              {group.items.map((conv) => (
                <div
                  key={conv.id}
                  className={`
                    group relative flex items-center mx-2 rounded-lg cursor-pointer
                    ${
                      activeId === conv.id
                        ? "bg-purple-accent/15 border border-purple-accent/30"
                        : "hover:bg-foreground/5 border border-transparent"
                    }
                  `}
                >
                  <button
                    onClick={() => onSelect(conv.id)}
                    className="flex-1 text-left px-3 py-2 min-w-0"
                  >
                    <span className="block text-sm font-mono text-foreground/70 truncate">
                      {conv.title}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    className="flex-shrink-0 w-6 h-6 mr-2 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-foreground/30 hover:text-red-400 transition-all"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
