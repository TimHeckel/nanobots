"use client";

import { use } from "react";
import ChatPageInner from "../_chat-page";

export default function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ChatPageInner conversationId={id} />;
}
