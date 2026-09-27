import { Component, type ErrorInfo, type ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import { btnPrimary, btnSecondary, btnGhost } from "../lib/uiClasses";

type Props = {
  children: ReactNode;
  /** Clears a caught error when this changes (e.g. the route path). */
  resetKey?: string;
};
type State = { error: Error | null; copied: boolean; resetKey?: string };

// After a redeploy, an open tab still references the old hashed chunk names,
// so the next lazy route import 404s. A reload is the actual fix for that.
function isStaleChunkError(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(error.message);
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey === state.resetKey) return null;
    return { resetKey: props.resetKey, error: null, copied: false };
  }

  private handleCopy = async () => {
    const { error } = this.state;
    if (!error) return;
    const details = [
      `Message: ${error.message}`,
      `Page: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
      "",
      error.stack ?? "",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(details);
      this.setState({ copied: true });
    } catch {
      window.prompt("Copy these details:", details);
    }
  };

  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;

    const stale = isStaleChunkError(error);

    return (
      <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <BrandMark size="lg" />
        <h1 className="text-lg font-semibold text-ink">
          {stale ? "A new version is available" : "Something went wrong"}
        </h1>
        <p className="text-sm text-muted max-w-md">
          {stale
            ? "IEEE Paper Builder was updated while this tab was open. Reload to get the latest version — your papers are saved."
            : "This page hit an unexpected error. Your papers autosave, so reloading is safe. If it keeps happening, copy the details and send them to us."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" className={btnPrimary} onClick={() => window.location.reload()}>
            Reload page
          </button>
          <button type="button" className={btnSecondary} onClick={() => window.location.assign("/dashboard")}>
            Go to dashboard
          </button>
          {!stale && (
            <button type="button" className={btnGhost} onClick={this.handleCopy}>
              {copied ? "Details copied" : "Copy error details"}
            </button>
          )}
        </div>
      </div>
    );
  }
}
