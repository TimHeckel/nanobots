import { ControlRoomShell } from "@/components/control-room/control-room-shell";
import { ConversationThreadPanel } from "@/components/control-room/conversation-thread-panel";
import { ChatInterface } from "@/components/chat/chat-interface";

interface ChatConversationPageProps {
  params: Promise<{ id: string }>;
}

function ConversationThreadShell({
  conversationId,
}: {
  conversationId: string;
}) {
  return (
    <div>
      <ConversationThreadPanel conversationId={conversationId} />
      <ChatInterface
        conversationId={conversationId}
        org={{
          id: "org-control-room",
          name: "Control Room Org",
          login: "control-room-org",
          avatarUrl: null,
        }}
        user={{
          id: "user-control-room",
          name: "Control Room Operator",
          login: "control-room-operator",
          avatarUrl: null,
        }}
      />
    </div>
  );
}

export default async function ChatConversationPage({
  params,
}: ChatConversationPageProps) {
  const { id } = await params;
  return (
    <ControlRoomShell>
      <ConversationThreadShell conversationId={id} />
    </ControlRoomShell>
  );
}
