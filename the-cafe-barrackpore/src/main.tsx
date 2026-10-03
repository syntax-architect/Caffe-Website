import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import Root from './Root';

const rootEl = document.getElementById('root')!;

// When static pre-rendered HTML is present, hydrate seamlessly without layout flashing
if (rootEl.hasChildNodes() && !rootEl.querySelector('.initial-loader')) {
  hydrateRoot(rootEl, <Root />);
} else {
  createRoot(rootEl).render(<Root />);
}
