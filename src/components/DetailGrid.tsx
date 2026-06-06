interface DetailRow {
  label: string;
  value: string | null | undefined;
}

interface DetailGridProps {
  rows: DetailRow[];
}

export function DetailGrid({ rows }: DetailGridProps) {
  return (
    <dl className="detail-grid">
      {rows.map((row) => (
        <div key={row.label} className="detail-grid-row">
          <dt>{row.label}</dt>
          <dd>{row.value?.trim() ? row.value : '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
