import { Component, type ReactNode } from "react";

import { getMessages } from "../../../i18n";

type Props = { children: ReactNode };
type State = { hasError: boolean; retryCount: number };

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 500;

export class ThreadsSidebarErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, retryCount: 0 };

    static getDerivedStateFromError(): Partial<State> {
        return { hasError: true };
    }

    componentDidUpdate(_prevProps: Props, prevState: State) {
        if (this.state.hasError && !prevState.hasError && this.state.retryCount < MAX_RETRIES) {
            setTimeout(() => {
                this.setState((prev) => ({
                    hasError: false,
                    retryCount: prev.retryCount + 1,
                }));
            }, RETRY_DELAY_MS);
        }
    }

    render() {
        if (this.state.hasError) {
            if (this.state.retryCount >= MAX_RETRIES) {
                return (
                    <div style={{ padding: 12, color: "#888" }}>
                        {getMessages().common.editor.couldNotLoadComments}
                    </div>
                );
            }
            return null;
        }
        return this.props.children;
    }
}
