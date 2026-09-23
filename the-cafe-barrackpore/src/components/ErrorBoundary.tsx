import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="w-full py-20 flex flex-col items-center justify-center text-on-surface text-center px-4 bg-surface-container-low">
          <span className="material-symbols-outlined text-4xl mb-4 text-primary">wifi_off</span>
          <h2 className="font-headline-md text-2xl mb-2">Connection Lost</h2>
          <p className="font-body-md text-on-surface/70 max-w-md mx-auto mb-6">
            We couldn't load this part of the page due to a network issue. Please check your connection and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-full border border-primary text-primary hover:bg-primary hover:text-background transition-colors font-label-md"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
