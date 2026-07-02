interface MemberListCardProps {
  result: unknown;
}

export function MemberListCard({ result }: MemberListCardProps) {
  return (
    <section>
      <h3>Control Room Member List</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
