import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Keeps one broken page from blanking the whole app during a demo. Mount it with a `key` per route so it resets on navigation. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="restricted-page">
          <div className="card card-pad">
            <div className="eyebrow">Something went wrong on this page</div>
            <p style={{ color: 'var(--ink-2)', fontSize: 13.5 }}>{this.state.error.message}</p>
            <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
