export const smoothScrollTo = (id: string) => {
  if (typeof window === 'undefined') return;

  const targetId = id === 'home' || id === 'root' ? null : (id.startsWith('#') ? id.slice(1) : id);

  if (!targetId) {
    const lenis = (window as any).__lenis;
    if (lenis && typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(0, { duration: 1.0 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return;
  }

  const el = document.getElementById(targetId);
  if (el) {
    const header = document.querySelector('header');
    const headerHeight = header ? header.offsetHeight : 80;
    // Provide 16px of comfortable breathing margin so section badges and titles are clearly visible below sticky header
    const offset = headerHeight + 16;

    const lenis = (window as any).__lenis;
    if (lenis && typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(el, { offset: -offset, duration: 1.0 });
    } else {
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
  }
};
