import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from './shims/sentry';
import { BrowserRouter } from './shims/react-router-dom';
import App from './App';
import './index.css';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: import.meta.env.VITE_SENTRY_TRACE_RATE ? parseFloat(import.meta.env.VITE_SENTRY_TRACE_RATE) : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
