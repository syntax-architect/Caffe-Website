import React from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs text-on-surface/60 font-sans mb-6 ${className}`}>
      <ol className="flex items-center flex-wrap gap-1.5 list-none p-0 m-0">
        <li>
          <a
            href="/"
            className="hover:text-primary transition-colors flex items-center gap-1 text-on-surface/75"
          >
            <span className="material-symbols-outlined text-sm font-light">home</span>
            <span>Home</span>
          </a>
        </li>
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-1.5">
            <span className="text-on-surface/30 select-none font-mono">/</span>
            {item.current || !item.href ? (
              <span className="text-primary font-medium" aria-current="page">
                {item.label}
              </span>
            ) : (
              <a
                href={item.href}
                className="hover:text-primary transition-colors text-on-surface/75"
              >
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
