interface DocGenerationCardProps {
  result: unknown;
}

export function DocGenerationCard({ result }: DocGenerationCardProps) {
  return (
    <section>
      <h3>Control Room Documentation Preview</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
