import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './design-system/index.css';
import './app.css';
import './workbench.css';

const root = document.getElementById('root');
document.documentElement.dataset.reducedMotion =
  localStorage.getItem('pidex.reduced-motion') ?? 'false';
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
