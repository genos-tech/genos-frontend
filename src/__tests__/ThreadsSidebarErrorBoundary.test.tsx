/**
 * Regression guard for the comment floating-card "stops opening until reload"
 * bug.
 *
 * BlockNote's floating comment card throws *during render* when a thread's
 * author / resolver isn't in its UserStore yet — a transient race. This
 * boundary catches that and retries. The bug: `retryCount` only ever climbed,
 * so a handful of unrelated transient throws over a session summed to
 * MAX_RETRIES and the card latched off (clicking highlighted text selected the
 * thread but no card appeared) until a full page reload remounted the boundary.
 *
 * The fix resets `retryCount` on every successful render, so the retry budget
 * is per-incident, not per-lifetime. These tests pin that: a card that throws
 * transiently far more than MAX_RETRIES times — but recovers between each —
 * must keep recovering, never latching.
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThreadsSidebarErrorBoundary } from "../components/editors/sub/ThreadsSidebarErrorBoundary";

const RETRY_DELAY_MS = 500;
const MAX_RETRIES = 5;

// A child that throws on render exactly while `armed` is true. Each distinct
// `instanceKey` forces a fresh mount, which is how we simulate a new comment
// card first rendering (and hitting the UserStore race).
let armed = false;
const Bomb = () => {
    if (armed) {
        throw new Error("comment author not resolved yet");
    }
    return <div data-testid="card">comment card</div>;
};

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("ThreadsSidebarErrorBoundary", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers();
        armed = false;
        // React logs every boundary-caught error to console.error; silence it
        // so the suite output isn't a wall of expected stack traces.
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        errorSpy.mockRestore();
        vi.useRealTimers();
    });

    it("renders children when they don't throw", () => {
        render(
            <ThreadsSidebarErrorBoundary>
                <Bomb key={0} />
            </ThreadsSidebarErrorBoundary>
        );
        expect(screen.getByTestId("card")).toBeInTheDocument();
    });

    it("recovers after a transient throw once the retry fires", () => {
        armed = true;
        render(
            <ThreadsSidebarErrorBoundary>
                <Bomb key={0} />
            </ThreadsSidebarErrorBoundary>
        );
        // Errored: fallback is null (below the give-up threshold), no card yet.
        expect(screen.queryByTestId("card")).not.toBeInTheDocument();

        armed = false;
        advance(RETRY_DELAY_MS);
        expect(screen.getByTestId("card")).toBeInTheDocument();
    });

    it("does not latch: transient throws well past MAX_RETRIES still recover", () => {
        const { rerender } = render(
            <ThreadsSidebarErrorBoundary>
                <Bomb key={0} />
            </ThreadsSidebarErrorBoundary>
        );
        expect(screen.getByTestId("card")).toBeInTheDocument();

        // Far more independent throw-then-recover incidents than the
        // consecutive-failure budget. The pre-fix counter would have hit
        // MAX_RETRIES and stuck on the fallback well before this loop ends.
        const incidents = MAX_RETRIES * 3;
        for (let i = 1; i <= incidents; i++) {
            // A fresh card mounts and throws...
            armed = true;
            rerender(
                <ThreadsSidebarErrorBoundary>
                    <Bomb key={i} />
                </ThreadsSidebarErrorBoundary>
            );
            expect(screen.queryByTestId("card")).not.toBeInTheDocument();

            // ...then the UserStore catches up and the retry succeeds.
            armed = false;
            advance(RETRY_DELAY_MS);
            expect(screen.getByTestId("card")).toBeInTheDocument();
        }

        // Never fell back to the permanent "could not load" state.
        expect(screen.queryByText(/could not load comments/i)).not.toBeInTheDocument();
    });

    it("gives up with a message only after MAX_RETRIES consecutive failures", () => {
        armed = true; // stays armed: every retry throws again — a real, persistent fault.
        render(
            <ThreadsSidebarErrorBoundary>
                <Bomb key={0} />
            </ThreadsSidebarErrorBoundary>
        );
        // Drive all the consecutive retries.
        for (let i = 0; i < MAX_RETRIES; i++) {
            advance(RETRY_DELAY_MS);
        }
        expect(screen.getByText(/could not load comments/i)).toBeInTheDocument();
    });
});
