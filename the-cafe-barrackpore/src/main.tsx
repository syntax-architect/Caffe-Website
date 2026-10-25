import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import Root from './Root';

const rootEl = document.getElementById('root')!;

const isPrerendered = Boolean(rootEl.querySelector('header, #theme-tokens, main'));

if (isPrerendered) {
  hydrateRoot(rootEl, <Root />);
} else {
  createRoot(rootEl).render(<Root />);
}

