"use client";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div>
      <p>{content}</p>
      <p>Control-room markdown rendering is in preview mode.</p>
    </div>
  );
}
