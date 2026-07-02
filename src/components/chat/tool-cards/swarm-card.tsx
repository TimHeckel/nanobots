interface SwarmCardProps {
  result: unknown;
}

export function SwarmCard({ result }: SwarmCardProps) {
  return (
    <section>
      <h3>Control Room Swarm Preview</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
