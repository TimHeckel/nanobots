"use client";

interface MessageBubbleProps {
  message: {
    role: string;
  };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <section>
      <h2>Operator Control Room Message</h2>
      <p>{message.role}</p>
    </section>
  );
}
