import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/app.css';
import { ToastProvider } from './ui';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnReconnect: true } },
});

// Service worker: precached shell for instant launches from the home screen; updates apply on the
// next launch (registerType autoUpdate) so nobody sees a stale build mid-demo.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
