export const smoothScrollTo = (id: string) => {
  const targetId = id === 'home' ? 'root' : id;
  const el = document.getElementById(targetId);
  if (el) {
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
};
