import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from 'react';

export interface KartonSectionHandle {
  expand: () => void;
  scrollIntoView: () => void;
}

interface KartonSectionProps {
  id: string;
  title: string;
  count: number;
  defaultOpen?: boolean;
  error?: string;
  children: ReactNode;
}

export const KartonSection = forwardRef<KartonSectionHandle, KartonSectionProps>(
  function KartonSection(
    { id, title, count, defaultOpen = true, error, children },
    ref,
  ) {
    const [open, setOpen] = useState(defaultOpen);
    const sectionRef = useRef<HTMLElement>(null);

    useImperativeHandle(ref, () => ({
      expand: () => setOpen(true),
      scrollIntoView: () => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }));

    return (
      <section ref={sectionRef} id={id} className="karton-section scroll-target">
        <button
          type="button"
          className="karton-section-header"
          aria-expanded={open}
          aria-controls={`${id}-content`}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="karton-section-title">
            {title} ({count})
          </span>
          <span className="karton-section-chevron" aria-hidden>
            {open ? '▾' : '▸'}
          </span>
        </button>
        {error && <p className="error section-error">{error}</p>}
        {open && <div id={`${id}-content`}>{children}</div>}
      </section>
    );
  },
);
