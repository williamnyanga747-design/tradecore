import React, {StrictMode, Component} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import UpdateBanner from './components/UpdateBanner.tsx';
import './index.css';
import {installSafeStorage} from './utils/safeStorage.ts';

class ErrorBoundary extends Component<{children: React.ReactNode}, {error: Error | null}> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', background: '#1e293b', color: '#f87171', minHeight: '100vh' }}>
          <h2 style={{ color: '#fbbf24' }}>TradeCore crashed — open DevTools Console</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#f87171' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#94a3b8', fontSize: 11 }}>{this.state.error.stack}</pre>
          <button onClick={() => { localStorage.clear(); caches.keys().then(n => n.forEach(k => caches.delete(k))).then(() => location.reload()); }} style={{ marginTop: 16, padding: '8px 16px', background: '#c41e3a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Clear All Cache &amp; Reload
          </button>
        </div>
      );
    }
    // @ts-expect-error React 19 type issue
    return this.props.children;
  }
}

window.onerror = (msg, src, line, col, err) => {
  console.error('[TradeCore Global Error]', msg, err);
};
window.onunhandledrejection = (e) => {
  console.error('[TradeCore Unhandled]', e.reason);
};

installSafeStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <UpdateBanner />
    </ErrorBoundary>
  </StrictMode>,
);
