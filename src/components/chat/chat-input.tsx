"use client";

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend: _onSend, isLoading: _isLoading }: ChatInputProps) {
  return (
    <section>
      <h2>Operator Control Room Input</h2>
      <p>Conversation input is in preview mode.</p>
    </section>
  );
}
