import { Component, type ReactNode } from 'react';

/** Isola falhas de uma seção: um erro nos vídeos nunca derruba o rádio. */
export class ErrorBoundary extends Component<{ fallback: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.error('[RCV] falha isolada na seção:', err);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="empty glass" role="alert">
        <p>{this.props.fallback}</p>
        <button type="button" className="btn btn--glass" onClick={() => this.setState({ failed: false })}>
          Tentar novamente
        </button>
      </div>
    );
  }
}
