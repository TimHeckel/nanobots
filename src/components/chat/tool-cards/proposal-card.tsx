interface ProposalCardProps {
  result: unknown;
}

export function ProposalCard({ result }: ProposalCardProps) {
  return (
    <section>
      <h3>Control Room Proposal Preview</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
