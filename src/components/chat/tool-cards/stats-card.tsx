interface StatsCardProps {
  result: unknown;
}

export function StatsCard({ result }: StatsCardProps) {
  return (
    <section>
      <h3>Control Room Stats Preview</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
