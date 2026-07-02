"use client";

export interface ConversationItem {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatSidebarProps {
  conversations: ConversationItem[];
}

export function ChatSidebar({ conversations }: ChatSidebarProps) {
  return (
    <aside>
      <h2>Operator Control Room Sidebar</h2>
      <p>{conversations.length} conversations</p>
    </aside>
  );
}
