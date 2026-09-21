export const smoothScrollTo = (id: string) => {
  const targetId = id === 'home' ? 'root' : id;
  const el = document.getElementById(targetId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};
