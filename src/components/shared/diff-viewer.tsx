interface DiffViewerProps {
  current: string;
  proposed: string;
}

export function DiffViewer({ current, proposed }: DiffViewerProps) {
  return (
    <section>
      <h3>Control Room Diff Preview</h3>
      <pre>{current}</pre>
      <pre>{proposed}</pre>
    </section>
  );
}
