/**
 * The loading and error panes are the loaded task's frame (`TaskPreviewLayout`)
 * until the task arrives, so they must be the same SHAPE on a phone: the
 * full-screen overlay gives the loaded task no 500px floor, no 16px corners, no
 * border and no shadow, and a loader that kept them rendered as a rounded card
 * in the overlay (visible dark corners, a gap at the bottom) that reflowed into
 * an edge-to-edge page when the task landed.
 *
 * jsdom doesn't evaluate media queries (and its CSSOM drops what it can't parse),
 * so this reads the rules emotion wrote into its <style> tags: the part of the
 * contract that is checkable here is WHICH breakpoint each value sits behind.
 * The pixels were measured in Chrome at 375x667 and 390x844 (see the PR).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskPaneError } from "../features/tasks/components/contents/base/TaskPaneError";
import { TaskPaneLoading } from "../features/tasks/components/contents/base/TaskPaneLoading";

// Joy's default breakpoints: xs = 0, md = 900 (what `useIsMobile` calls "mobile").
const rulesFor = (el: HTMLElement) => {
    const raw = Array.from(document.querySelectorAll("style"))
        .map((tag) => tag.textContent ?? "")
        .join("\n");
    const cls = Array.from(el.classList).find((c) => c.startsWith("css-")) ?? "";
    const at = (query: string) =>
        raw.match(new RegExp(`@media \\(min-width:${query}\\)\\{\\.${cls}\\{([^}]*)\\}\\}`))?.[1];
    // Everything outside a media query is the block between `.cls{` and its first `}`.
    const base = raw.match(new RegExp(`\\.${cls}\\{([^}]*)\\}`))?.[1] ?? "";
    return { base, mobile: at("0px"), desktop: at("900px") };
};

const frames: Array<[string, () => HTMLElement]> = [
    [
        "TaskPaneLoading",
        () => {
            render(
                <CssVarsProvider>
                    <TaskPaneLoading isDark={false} label="Loading task" />
                </CssVarsProvider>
            );
            return document.querySelector('[role="status"]') as HTMLElement;
        },
    ],
    [
        "TaskPaneError",
        () => {
            render(
                <CssVarsProvider>
                    <TaskPaneError
                        cancelLabel="Cancel"
                        title="Failed"
                        onCancel={vi.fn()}
                        onRetry={vi.fn()}
                    />
                </CssVarsProvider>
            );
            return document.querySelector('[data-pane="task-error"]') as HTMLElement;
        },
    ],
];

describe.each(frames)("%s frame", (_name, mount) => {
    it("is a full-screen frame below md: no height floor, corners, border or shadow", () => {
        const { mobile, base } = rulesFor(mount());

        expect(mobile).toBeDefined();
        expect(mobile).toContain("min-height:0");
        expect(mobile).toContain("border-radius:0");
        expect(mobile).toContain("border:none");
        expect(mobile).toContain("box-shadow:none");
        // None of it is set unconditionally.
        expect(base).not.toContain("min-height:500px");
        expect(base).not.toContain("border-radius:16px");
    });

    it("keeps the desktop card from md up", () => {
        const { desktop } = rulesFor(mount());

        expect(desktop).toBeDefined();
        expect(desktop).toContain("min-height:500px");
        // The loader keeps its own literals; the error pane (MIP-1306) draws the same
        // footprint from the tokens.
        if (_name === "TaskPaneError") {
            expect(desktop).toContain("border-radius:var(--g-radius-lg)");
            expect(desktop).toContain("border:1px solid var(--g-border)");
            expect(desktop).toContain("box-shadow:var(--g-shadow-md)");
        } else {
            expect(desktop).toContain("border-radius:16px");
            expect(desktop).toContain("border:1px solid rgba(0,0,0,0.08)");
            expect(desktop).toContain("box-shadow:0 8px 32px");
        }
    });
});
