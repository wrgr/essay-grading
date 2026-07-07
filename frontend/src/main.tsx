import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import '@fontsource-variable/fraunces';
import '@fontsource/ibm-plex-mono';
import './index.css';
import { AuthProvider } from './auth';
import AppShell from './AppShell';
import Login from './pages/Login';
import Home from './pages/Home';
import Settings from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// Hash router so the SPA works from any subpath / static file server without
// server-side rewrite rules (same reason TGFWA built with base:'./').
const router = createHashRouter([
  { path: '/login', element: <Login /> },
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
