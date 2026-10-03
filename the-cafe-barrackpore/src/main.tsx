import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import Root from './Root';

const rootEl = document.getElementById('root')!;

if (rootEl.hasChildNodes() && !rootEl.querySelector('.initial-loader')) {
  hydrateRoot(rootEl, <Root />);
} else {
  createRoot(rootEl).render(<Root />);
}

