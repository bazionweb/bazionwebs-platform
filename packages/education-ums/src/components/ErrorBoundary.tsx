import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // eslint-disable-next-line no-console
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
                    <div className="text-red-500 text-5xl mb-4">!!</div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
                    <p className="text-gray-600 mb-4 text-center max-w-md">
                        An unexpected error occurred. Please try refreshing the page.
                    </p>
                    <details className="mb-4 text-sm text-gray-500 max-w-lg">
                        <summary className="cursor-pointer">Error details</summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto text-xs">
                            {this.state.error?.message}
                        </pre>
                    </details>
                    <button
                        onClick={this.handleReset}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Try Again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
