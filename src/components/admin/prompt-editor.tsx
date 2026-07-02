"use client";

interface PromptEditorProps {
  agentName: string;
  description: string;
}

export function PromptEditor({
  agentName,
  description,
}: PromptEditorProps) {
  return (
    <section>
      <h2>{agentName}</h2>
      <p>{description}</p>
      <p>Prompt editing is in control-room preview mode.</p>
    </section>
  );
}
