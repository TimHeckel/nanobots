interface ScanResultsCardProps {
  result: unknown;
}

export function ScanResultsCard({ result }: ScanResultsCardProps) {
  return (
    <section>
      <h3>Control Room Scan Results</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
