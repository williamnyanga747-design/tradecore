// @ts-nocheck
// React 19 class components work at runtime but TypeScript can't resolve
// React.Component without @types/react. This file is excluded from type checking.
import React from 'react';

// Purpose-built error boundary for the Recharts dashboard blocks.
// Recharts 3.x + React 19 can throw Error #185 ("Maximum update depth exceeded")
// from its internal react-redux store / legend dispatcher when chart data
// receives fresh array references during a PHP sync. Without a boundary this
// takes down the whole app (white screen). This boundary confines the failure
// to the chart card, and `resetKey` auto-recovers once data changes again.
export default class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.error('[ChartErrorBoundary] Recharts render error caught:', error?.message || error);
  }
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px] w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-center">
          <div>
            <p className="text-gray-700 font-semibold text-xs">Visualization unavailable</p>
            <p className="text-gray-400 text-[10px] mt-1 font-bold">Chart data reloads automatically with the next sync.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}