import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { AppShell } from './components/layout/AppShell';

interface ErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="ambient-bg min-h-screen flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 text-center space-y-4">
            <h1 className="font-display text-lg font-semibold text-white">
              Something went wrong
            </h1>
            <p className="text-xs text-[#A3A3A3] break-words">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-dynamic-accent rounded-xl px-4 py-2 text-xs font-semibold text-[#1A1A1C] hover:opacity-90 active:scale-95 transition-all"
            >
              Reload Growy
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="ambient-bg min-h-screen flex items-center justify-center">
        <div
          className="h-6 w-6 rounded-full border-2 animate-spin"
          style={{
            borderColor: 'color-mix(in srgb, var(--accent-color) 25%, transparent)',
            borderTopColor: 'var(--accent-color)',
          }}
        />
      </div>
    );
  }

  return user ? <AppShell /> : <AuthScreen />;
}

export function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <ThemeProvider>
            <CurrencyProvider>
              <AppContent />
            </CurrencyProvider>
          </ThemeProvider>
        </LanguageProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
