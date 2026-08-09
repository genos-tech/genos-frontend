import { Component, type ErrorInfo, type ReactNode } from "react";

import { fmt, useTranslation } from "../i18n";

type Props = {
    /** Short label used in the fallback message and the console log so we
     * can distinguish which feature crashed when triaging. */
    feature: string;
    children: ReactNode;
};

type InnerProps = Props & {
    copy: {
        title: string;
        recovery: string;
    };
};

type State = { hasError: boolean; error: Error | null };

// Coarse-grained crash boundary used around each feature root (chatHome,
// NoteHome, taskHome) so a runtime exception in one feature doesn't blank
// the entire workspace. Unlike the narrower `ThreadsSidebarErrorBoundary`,
// this one does NOT auto-retry — a thrown exception at the feature root
// is almost always a bug, and silently re-mounting would mask it. We log
// to the console (kept visible for the dev / oncall path) and render a
// minimal fallback so the surrounding chrome (sidebars, theme, auth) still
// works. The user can switch to another feature without a full reload.
class FeatureErrorBoundaryInner extends Component<InnerProps, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error(
            `[FeatureErrorBoundary:${this.props.feature}] caught error`,
            error,
            info.componentStack
        );
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        padding: "2rem",
                        textAlign: "center",
                        color: "var(--muted-foreground, #888)",
                        fontSize: "0.9rem",
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                        {fmt(this.props.copy.title, { feature: this.props.feature })}
                    </div>
                    <div>{this.props.copy.recovery}</div>
                </div>
            );
        }
        return this.props.children;
    }
}

export const FeatureErrorBoundary = ({ feature, children }: Props) => {
    const { t } = useTranslation();
    return (
        <FeatureErrorBoundaryInner copy={t.common.featureError} feature={feature}>
            {children}
        </FeatureErrorBoundaryInner>
    );
};
