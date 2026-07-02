interface ProposalListCardProps {
  result: unknown;
}

export function ProposalListCard({ result }: ProposalListCardProps) {
  return (
    <section>
      <h3>Control Room Proposal List</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
