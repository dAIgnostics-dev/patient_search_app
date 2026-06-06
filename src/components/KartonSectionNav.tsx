interface SectionNavItem {
  id: string;
  label: string;
}

interface KartonSectionNavProps {
  sections: SectionNavItem[];
  onNavigate: (id: string) => void;
}

export function KartonSectionNav({ sections, onNavigate }: KartonSectionNavProps) {
  return (
    <nav className="karton-section-nav" aria-label="Karton sections">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          className="section-nav-link"
          onClick={() => onNavigate(section.id)}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}
