import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { ChatUnreadProvider } from './context/ChatUnreadContext'
import { FeatureFlagsProvider } from './context/FeatureFlagsContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './hooks/useTheme'
import { initMonitoring } from './lib/monitoring'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

initMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ErrorBoundary>
            <FeatureFlagsProvider>
              <AuthProvider>
                <ToastProvider>
                  <NotificationsProvider>
                    <ChatUnreadProvider>
                      <App />
                    </ChatUnreadProvider>
                  </NotificationsProvider>
                </ToastProvider>
              </AuthProvider>
            </FeatureFlagsProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>,
)
