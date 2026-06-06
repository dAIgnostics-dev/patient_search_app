export function PatientListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="patient-list-skeleton" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="skeleton skeleton-list-row" />
      ))}
    </ul>
  );
}
