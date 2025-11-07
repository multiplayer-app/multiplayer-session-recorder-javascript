import React from 'react'
import SessionRecorder from '@multiplayer-app/session-recorder-browser'

export type ErrorBoundaryProps = {
  children: React.ReactNode
  /** Optional fallback UI to render when an error is caught */
  fallback?: React.ReactNode
}

type State = { hasError: boolean }

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    try {
      SessionRecorder.captureException(error, errorInfo)
    } catch (_e) {
      // no-op
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}

export default ErrorBoundary
