interface ActivityFeedCardProps {
  result: unknown;
}

export function ActivityFeedCard({ result }: ActivityFeedCardProps) {
  return (
    <section>
      <h3>Control Room Activity Feed</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
