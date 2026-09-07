// @ts-nocheck
import React from 'react';

/**
 * PanelBoundary wraps a full-page panel (Inventory, Sales, Reports, etc.) so
 * that a render crash in one panel does NOT take down the entire App shell.
 * The sidebar, header, and other panels remain visible.
 */
export default class PanelBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[PanelBoundary] panel render error caught:', error?.message || error, info?.componentStack || '');
  }
  render() {
    if (this.state.hasError) {
      const panelName = this.props.panelName || 'This panel';
      return (
        <div className="flex-1 flex items-center justify-center min-h-[400px] bg-white rounded-2xl border border-gray-200 p-8">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-gray-800 font-bold text-sm mb-1">{panelName} crashed</h3>
            <p className="text-gray-500 text-xs mb-4">A temporary error occurred. The rest of the app is working normally.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-lg hover:bg-brand-dark transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
