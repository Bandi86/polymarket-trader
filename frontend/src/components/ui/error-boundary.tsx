"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>

          <div className="text-center">
            <h2 className="text-xl font-bold text-zinc-100">Valami elromlott</h2>
            <p className="mt-2 max-w-md text-sm text-zinc-400">
              {this.state.error?.message || "Ismeretlen hiba történt."}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 rounded-lg bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Újratöltés
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}