import { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from '../shims/lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-gray-50 rounded-xl border border-red-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 text-center max-w-md mb-8">
            An unexpected error occurred in this section of the portal. Our team has been notified.
          </p>
          {this.state.error && (
            <div className="w-full max-w-lg mb-8 p-4 bg-white rounded-lg border border-red-100 overflow-x-auto">
              <pre className="text-xs text-red-600 font-mono">
                {this.state.error.message}
              </pre>
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-6 py-3 bg-[#4B0082] hover:bg-[#3a0066] text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            <RefreshCw size={18} />
            <span>Reload Page</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
