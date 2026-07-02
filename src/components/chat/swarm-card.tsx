"use client";

interface SwarmCardProps {
  name: string;
}

export function SwarmCard({ name }: SwarmCardProps) {
  return (
    <section>
      <h2>{name}</h2>
      <p>Control-room swarm cards are in preview mode.</p>
    </section>
  );
}
