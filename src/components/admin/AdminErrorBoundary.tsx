import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { Capacitor } from '@capacitor/core';

interface Props {
  children: ReactNode;
  onClose: () => void; // Called to simply close the panel — app stays alive
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * AdminErrorBoundary — Dedicated error boundary specifically for AdminPanel.
 *
 * WHY this exists instead of GlobalErrorBoundary:
 * - GlobalErrorBoundary wraps the whole <App />, so when AdminPanel crashes,
 *   it blocks the ENTIRE app and the user cannot even close the panel.
 * - This boundary wraps ONLY the AdminPanel. If AdminPanel crashes, it shows
 *   a recovery UI INSIDE the panel overlay, and the user can close it
 *   gracefully without the rest of the app being affected.
 */
export class AdminErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AdminPanel Crash]', error.message, errorInfo.componentStack);

    // Log to Supabase for remote monitoring
    try {
      if (supabase) {
        supabase.from('app_errors').insert({
          error_message: `[AdminPanel] ${error.message}`,
          stack_trace: error.stack || errorInfo.componentStack || 'No stack',
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            isNative: Capacitor.isNativePlatform(),
            component: 'AdminPanel',
          },
          app_version: '1.0.0-phase1',
        }).then(({ error: logErr }: any) => {
          if (logErr) console.warn('Failed to log admin crash:', logErr);
        });
      }
    } catch (_) {}
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col items-center justify-center p-6">
          {/* Close button — closes panel, app stays alive */}
          <button
            onClick={this.props.onClose}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white shadow flex items-center justify-center text-gray-400 active:scale-90 transition-transform"
            aria-label="Close Admin Panel"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full border border-red-100 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Admin Panel Error
            </h2>
            <p className="text-gray-500 text-sm mb-2 leading-relaxed">
              Something went wrong while loading the Admin Panel. This may be due to a data issue from the server.
            </p>
            {this.state.error && (
              <p className="text-red-400 text-xs font-mono bg-red-50 rounded-lg px-3 py-2 mb-6 text-left break-words">
                {this.state.error.message}
              </p>
            )}

            <div className="flex flex-col gap-3">
              {/* Retry — tries to re-render AdminPanel */}
              <button
                onClick={this.handleRetry}
                className="w-full py-3.5 bg-black text-white rounded-xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>

              {/* Close — simply closes panel, rest of app is unaffected */}
              <button
                onClick={this.props.onClose}
                className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-medium active:scale-95 transition-transform"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
