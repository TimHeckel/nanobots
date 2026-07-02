interface ToolResultRendererProps {
  toolName: string;
  result: unknown;
}

export function ToolResultRenderer({
  toolName,
  result,
}: ToolResultRendererProps) {
  return (
    <section>
      <h2>Control Room Tool Result</h2>
      <p>{toolName}</p>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}
