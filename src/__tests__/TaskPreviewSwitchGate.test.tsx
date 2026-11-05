/**
 * MIP-962: switching tasks on the task page must show the loading pane until
 * the next task is loaded, instead of leaving the previous task on screen.
 *
 * `TaskPreview` itself is too heavy to mount here (dozens of hooks and child
 * blocks), so these test the two pieces that carry the behaviour: the pure
 * decision (`getTaskPreviewPaneState`) and the component that applies it
 * (`TaskPreviewSwitchGate`, rendered with the REAL `TaskPaneLoading`). The
 * switch is simulated the way `TaskPreview` experiences it: the requested id
 * flips first, the working copy follows when the load lands.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskPaneLoading } from "../features/tasks/components/contents/base/TaskPaneLoading";
import {
    SWITCH_LOADER_DELAY_MS,
    TaskPreviewSwitchGate,
} from "../features/tasks/components/contents/base/TaskPreviewSwitchGate";
import {
    getTaskPreviewPaneState,
    TaskPreviewPaneInput,
} from "../features/tasks/utils/taskPreviewPaneState";

const LABEL = "Loading task…";

const base: TaskPreviewPaneInput = {
    workingCopyId: 1,
    requestedId: 1,
    guard: true,
    releaseOnLoadFailure: false,
    loadFailedTaskId: null,
};

describe("getTaskPreviewPaneState", () => {
    it("shows the task when the working copy is the requested task", () => {
        expect(getTaskPreviewPaneState(base)).toBe("content");
    });

    it("A -> B before B lands: switching (never A's content under B)", () => {
        expect(getTaskPreviewPaneState({ ...base, requestedId: 2 })).toBe("switching");
    });

    it("B lands: content again", () => {
        expect(getTaskPreviewPaneState({ ...base, workingCopyId: 2, requestedId: 2 })).toBe(
            "content"
        );
    });

    it("first open (nothing loaded yet) is loading, not switching", () => {
        expect(
            getTaskPreviewPaneState({ ...base, workingCopyId: undefined, requestedId: 2 })
        ).toBe("loading");
    });

    it("nothing requested renders nothing / keeps whatever is loaded", () => {
        expect(
            getTaskPreviewPaneState({ ...base, workingCopyId: undefined, requestedId: -1 })
        ).toBe("empty");
        // Deselect (-1) with a stale working copy is not a mismatch.
        expect(getTaskPreviewPaneState({ ...base, requestedId: -1 })).toBe("content");
    });

    it("compares ids as strings (number vs string ids)", () => {
        expect(getTaskPreviewPaneState({ ...base, workingCopyId: "2", requestedId: 2 })).toBe(
            "content"
        );
    });

    it("without the guard the working copy alone decides (unchanged hosts)", () => {
        expect(getTaskPreviewPaneState({ ...base, guard: false, requestedId: 2 })).toBe("content");
    });

    it("a failed load releases the guard only for hosts that opt in (no endless spinner)", () => {
        const failed = { ...base, requestedId: 2, loadFailedTaskId: 2 };
        // Task page: falls back to the previously loaded task, as before.
        expect(getTaskPreviewPaneState({ ...failed, releaseOnLoadFailure: true })).toBe("content");
        // Chat: keeps guarding (never show a different task after a failed load).
        expect(getTaskPreviewPaneState({ ...failed, releaseOnLoadFailure: false })).toBe(
            "switching"
        );
        // A failure for some OTHER task does not release this one.
        expect(
            getTaskPreviewPaneState({
                ...base,
                requestedId: 2,
                loadFailedTaskId: 9,
                releaseOnLoadFailure: true,
            })
        ).toBe("switching");
    });
});

// Mimics TaskPreview's call: working copy id + requested id -> gate.
const Host = ({
    workingCopyId,
    requestedId,
    holdOutgoing,
    loadFailedTaskId = null,
}: {
    workingCopyId: number | undefined;
    requestedId: number;
    holdOutgoing: boolean;
    loadFailedTaskId?: number | null;
}) => (
    <CssVarsProvider>
        <TaskPreviewSwitchGate
            holdOutgoing={holdOutgoing}
            isDark={false}
            loadingLabel={LABEL}
            state={getTaskPreviewPaneState({
                workingCopyId,
                requestedId,
                guard: true,
                releaseOnLoadFailure: holdOutgoing,
                loadFailedTaskId,
            })}
        >
            {() => <div data-testid="task-view">task {workingCopyId}</div>}
        </TaskPreviewSwitchGate>
    </CssVarsProvider>
);

const isHidden = (el: HTMLElement) => {
    for (let n: HTMLElement | null = el; n; n = n.parentElement) {
        if (getComputedStyle(n).display === "none") return true;
    }
    return false;
};

// Emotion keeps every rule it ever injected, so assert on the rules of the
// element under test (its generated class), not on the whole stylesheet.
const cssOf = (el: HTMLElement) => {
    const cls = Array.from(el.classList).find((c) => c.startsWith("css-"));
    const all = Array.from(document.querySelectorAll("style"))
        .map((st) => st.textContent ?? "")
        .join("\n");
    return all
        .split("\n")
        .filter((line) => cls && line.includes(`.${cls}`))
        .join("\n");
};

describe("TaskPreviewSwitchGate — task page (holdOutgoing)", () => {
    it("A -> B: loading pane shown, A hidden (not B's selection under A's content), then B", () => {
        const { rerender } = render(<Host requestedId={1} workingCopyId={1} holdOutgoing />);
        expect(screen.getByTestId("task-view").textContent).toBe("task 1");
        expect(screen.queryByRole("status")).toBeNull();

        // User picks B; the load has not landed.
        rerender(<Host requestedId={2} workingCopyId={1} holdOutgoing />);
        const loader = screen.getByRole("status");
        expect(loader.getAttribute("aria-label")).toBe(LABEL);
        // A is NOT visible. It stays MOUNTED (hidden) so its unsaved state and
        // the switch effect behave exactly as before.
        expect(isHidden(screen.getByTestId("task-view"))).toBe(true);

        // B lands.
        rerender(<Host requestedId={2} workingCopyId={2} holdOutgoing />);
        expect(screen.queryByRole("status")).toBeNull();
        const view = screen.getByTestId("task-view");
        expect(view.textContent).toBe("task 2");
        expect(isHidden(view)).toBe(false);
    });

    it("does not remount the task view across a switch (outgoing state survives)", () => {
        const { rerender } = render(<Host requestedId={1} workingCopyId={1} holdOutgoing />);
        const before = screen.getByTestId("task-view");
        rerender(<Host requestedId={2} workingCopyId={1} holdOutgoing />);
        expect(screen.getByTestId("task-view")).toBe(before);
        rerender(<Host requestedId={2} workingCopyId={2} holdOutgoing />);
        expect(screen.getByTestId("task-view")).toBe(before);
    });

    it("switch: card surface is immediate, only the dots + label are delayed", () => {
        render(<Host requestedId={2} workingCopyId={1} holdOutgoing />);
        const sheet = screen.getByRole("status");
        const surface = cssOf(sheet);
        // No blank pane: the card itself has no entrance animation or delay.
        expect(surface).toContain("animation:none");
        expect(surface).not.toMatch(/\d+ms both/);
        expect(surface).toMatch(/linear-gradient\(180deg/);
        // Dots (2nd child, after the accent bar) and caption fade in after the delay.
        const delayed = new RegExp(`${SWITCH_LOADER_DELAY_MS}ms both`);
        expect(cssOf(sheet.children[1] as HTMLElement)).toMatch(delayed);
        expect(cssOf(screen.getByText(LABEL))).toMatch(delayed);
        // The accent bar is part of the surface: not delayed.
        expect(cssOf(sheet.children[0] as HTMLElement)).not.toMatch(/\d+ms both/);
    });

    it("a failed load falls back to the previous task, no permanent loader", () => {
        const { rerender } = render(<Host requestedId={2} workingCopyId={1} holdOutgoing />);
        expect(screen.getByRole("status")).toBeTruthy();
        rerender(<Host loadFailedTaskId={2} requestedId={2} workingCopyId={1} holdOutgoing />);
        expect(screen.queryByRole("status")).toBeNull();
        expect(isHidden(screen.getByTestId("task-view"))).toBe(false);
    });
});

describe("TaskPreviewSwitchGate — chat host (guardStaleTaskId, unchanged)", () => {
    it("A -> B: loader immediately, A UNMOUNTED, no delay, no release on failure", () => {
        const { rerender } = render(
            <Host holdOutgoing={false} requestedId={1} workingCopyId={1} />
        );
        rerender(<Host holdOutgoing={false} requestedId={2} workingCopyId={1} />);
        expect(screen.getByRole("status")).toBeTruthy();
        expect(screen.queryByTestId("task-view")).toBeNull();
        expect(cssOf(screen.getByRole("status"))).not.toMatch(/\d+ms both/);

        rerender(
            <Host holdOutgoing={false} loadFailedTaskId={2} requestedId={2} workingCopyId={1} />
        );
        expect(screen.getByRole("status")).toBeTruthy();
        expect(screen.queryByTestId("task-view")).toBeNull();
    });
});

describe("TaskPaneLoading", () => {
    it("defaults to no delay (original behaviour: whole pane slides in at once)", () => {
        render(
            <CssVarsProvider>
                <TaskPaneLoading isDark={false} label="plain" />
            </CssVarsProvider>
        );
        const sheet = screen.getByRole("status");
        expect(cssOf(sheet)).toContain("slideIn 0.3s ease-out;");
        expect(cssOf(sheet)).not.toMatch(/\d+ms both/);
        expect(cssOf(sheet.children[1] as HTMLElement)).not.toMatch(/\d+ms both/);
        expect(cssOf(screen.getByText("plain"))).not.toMatch(/\d+ms both/);
    });

    it("fadeInDelayMs delays only the dots + label, with a reduced-motion variant that keeps the delay", () => {
        render(
            <CssVarsProvider>
                <TaskPaneLoading fadeInDelayMs={150} isDark={false} label="delayed" />
            </CssVarsProvider>
        );
        const sheet = screen.getByRole("status");
        // Surface: visible immediately.
        expect(cssOf(sheet)).toContain("animation:none");
        expect(cssOf(sheet)).not.toMatch(/\d+ms both/);
        // Dots and caption: delayed fade, plus the reduced-motion step.
        for (const el of [sheet.children[1] as HTMLElement, screen.getByText("delayed")]) {
            const css = cssOf(el);
            expect(css).toMatch(/0\.2s ease-out 150ms both/);
            expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
            expect(css).toMatch(/1ms linear 150ms both/);
        }
    });
});
