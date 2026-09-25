import Button from '@mui/material/Button';
import { bugsnagClient } from 'app/modules/editor/scripts/bugsnag';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface PanelErrorBoundaryProps {
  // Reported to Bugsnag.
  readonly panel: string;
  readonly children: ReactNode;
}

/** Replaces a panel that fails to render, so that the rest of the editor keeps working. */
export class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, { componentStack }: ErrorInfo) {
    bugsnagClient.notify(error, {
      severity: 'error',
      metadata: { panel: { name: this.props.panel, componentStack } },
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div className="app-panel-error fx-column fx-align-center fx-flex">
        <p>Sorry, something went wrong.</p>
        <Button
          color="secondary"
          onClick={event => {
            // Otherwise the click would clear the selections.
            event.stopPropagation();
            this.setState({ hasError: false });
          }}
        >
          Try again
        </Button>
      </div>
    );
  }
}
