interface SwarmListCardProps {
  result: unknown;
}

export function SwarmListCard({ result }: SwarmListCardProps) {
  return (
    <section>
      <h3>Control Room Swarm List</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
