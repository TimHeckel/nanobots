"use client";

interface BotCardProps {
  name: string;
}

export function BotCard({ name }: BotCardProps) {
  return (
    <section>
      <h2>{name}</h2>
      <p>Control-room bot cards are in preview mode.</p>
    </section>
  );
}
