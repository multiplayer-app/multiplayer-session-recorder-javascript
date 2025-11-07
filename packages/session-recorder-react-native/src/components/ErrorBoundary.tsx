import React from 'react';
import SessionRecorder from '../session-recorder';

export type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    try {
      SessionRecorder.captureException(error as any);
    } catch (_e) {
      // ignore
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
