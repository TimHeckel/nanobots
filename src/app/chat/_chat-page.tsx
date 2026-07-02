import { ControlRoomShell } from "@/components/control-room/control-room-shell";
import { ChatInterface } from "@/components/chat/chat-interface";

interface ChatPageInnerProps {
  conversationId?: string;
}

export default function ChatPageInner({ conversationId }: ChatPageInnerProps) {
  return (
    <ControlRoomShell>
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
    </ControlRoomShell>
  );
}
