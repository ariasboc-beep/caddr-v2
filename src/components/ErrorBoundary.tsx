import React from 'react';

interface State { hasError: boolean; message?: string; }

// Empêche qu'une erreur dans un composant fasse planter toute l'application
// (écran noir). Affiche un message de secours avec option de rechargement.
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crash caught by ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
          background: '#080708', color: '#E6E8E6',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", textAlign: 'center',
        }}>
          <div style={{ fontSize: 40 }}>😕</div>
          <h1 style={{ fontWeight: 900, fontSize: 20 }}>Une erreur est survenue</h1>
          <p style={{ opacity: 0.6, fontSize: 13, maxWidth: 340 }}>
            L'application a rencontré un problème. Vos données sont sauvegardées.
            Rechargez la page pour continuer.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '12px 24px', borderRadius: 16, border: 'none',
              background: 'var(--accent, #2FB0A6)', color: 'white', fontWeight: 900,
              textTransform: 'uppercase', letterSpacing: 1, fontSize: 11, cursor: 'pointer',
            }}
          >
            Recharger
          </button>
          {this.state.message && (
            <p style={{ opacity: 0.3, fontSize: 10, marginTop: 12, maxWidth: 340, wordBreak: 'break-word' }}>
              {this.state.message}
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
