import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => {
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', event => {
          const worker = event.target as ServiceWorker;
          if (worker.state === 'installed' && navigator.serviceWorker.controller) window.dispatchEvent(new Event('prioritymail-update'));
        });
      });
      void registration.update().catch(() => {});
    }).catch(() => window.dispatchEvent(new Event('prioritymail-offline-error')));
  });
}
