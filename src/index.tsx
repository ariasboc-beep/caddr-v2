/// <reference types="vite/client" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './index.css';

// Version de démonstration (artefact) : données d'exemple au premier lancement, sans compte
if (import.meta.env.VITE_DEMO === '1') {
  try {
    if (!localStorage.getItem('caddr_routine_v6_timing')) {
      const { demoData } = await import('./demoData');
      localStorage.setItem('caddr_routine_v6_timing', JSON.stringify(demoData()));
    }
    localStorage.setItem('caddr_guest', '1');
  } catch { /* stockage indisponible : l'app démarre vide */ }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Enregistrement du Service Worker (PWA) — uniquement en production
if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.VITE_DEMO !== '1' && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) =>
      console.error('SW registration failed:', err)
    );
  });
}
