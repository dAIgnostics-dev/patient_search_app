export function KartonSkeleton() {
  return (
    <div className="karton-skeleton" aria-hidden>
      <div className="skeleton skeleton-banner" />
      <div className="skeleton-summary-row">
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
      <div className="skeleton skeleton-section" />
      <div className="skeleton skeleton-section" />
      <div className="skeleton skeleton-section short" />
    </div>
  );
}
