// @ts-nocheck
// React 19 class components work at runtime but TypeScript can't resolve
// React.Component without @types/react. This file is excluded from type checking.
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Render error caught:', error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-[200px] p-4 bg-red-50 border border-red-200 rounded-lg m-4">
          <div className="text-center">
            <p className="text-red-800 font-medium">A component encountered an error</p>
            <p className="text-red-600 text-sm mt-1">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
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
