interface BotToggleCardProps {
  result: unknown;
}

export function BotToggleCard({ result }: BotToggleCardProps) {
  return (
    <section>
      <h3>Control Room Bot Toggle</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
