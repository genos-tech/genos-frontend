import { Component, type ReactNode } from "react";

import { getMessages } from "../../../i18n";

type Props = { children: ReactNode };
type State = { hasError: boolean; retryCount: number };

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 500;

/**
 * Wraps BlockNote's floating comment card (`FloatingThreadController`), which
 * throws *during render* when a thread's author or `resolvedBy` user isn't in
 * BlockNote's UserStore yet — a race on late-arriving Yjs updates or editor
 * recreation. The boundary swallows that throw and re-mounts the children a
 * beat later, by which time the store has caught up.
 *
 * `retryCount` bounds *consecutive* failures so a genuinely broken card
 * eventually shows a message instead of retrying forever. The critical part is
 * that a successful render RESETS it (see `componentDidUpdate`): without that
 * reset the counter only ever climbs, so unrelated transient hiccups accumulate
 * across a session until it reaches MAX_RETRIES and the card stays latched off
 * — clicking highlighted text selects the thread but no card ever appears —
 * until a full page reload remounts this boundary. (That reload was the only
 * reason it recovered; before the docked sidebar was removed, toggling it
 * remounted the boundary and masked the leak.)
 */
export class ThreadsSidebarErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, retryCount: 0 };
    private retryTimer: ReturnType<typeof setTimeout> | undefined;

    static getDerivedStateFromError(): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch() {
        // Fires whenever a child throws — on mount OR update. `getDerivedState`
        // has already flipped to the fallback; schedule a retry (dropping the
        // fallback) while we still have consecutive-failure budget. The guard
        // keeps a single retry in flight at a time.
        if (this.state.retryCount < MAX_RETRIES && this.retryTimer === undefined) {
            this.retryTimer = setTimeout(() => {
                this.retryTimer = undefined;
                this.setState((prev) => ({ hasError: false, retryCount: prev.retryCount + 1 }));
            }, RETRY_DELAY_MS);
        }
    }

    componentDidUpdate(_prevProps: Props, prevState: State) {
        if (!this.state.hasError && prevState.hasError) {
            // Recovered: the error was transient, so forget the accumulated
            // failures. A fresh hiccup later then gets the full retry budget
            // again instead of the count creeping toward MAX_RETRIES and
            // permanently latching the comment card off.
            this.setState({ retryCount: 0 });
        }
    }

    componentWillUnmount() {
        // The editor can unmount (tab switch, navigation) inside the retry
        // window; don't setState on a dead component.
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
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
