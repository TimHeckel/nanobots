interface BotListCardProps {
  result: unknown;
}

export function BotListCard({ result }: BotListCardProps) {
  return (
    <section>
      <h3>Control Room Bot List</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
