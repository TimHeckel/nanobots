interface WebhookListCardProps {
  result: unknown;
}

export function WebhookListCard({ result }: WebhookListCardProps) {
  return (
    <section>
      <h3>Control Room Webhook List</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
