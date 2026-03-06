"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6 text-center">
          <h3 className="text-sm font-medium text-red-400">
            Something went wrong
          </h3>
          <p className="mt-2 text-xs text-slate-400">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
