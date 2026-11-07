/**
 * The shared message / comment frame (MIP-1130).
 *
 * jsdom cannot compute the token colors, so the colors are guarded two other
 * ways: the source may not contain a literal color, and the tertiary meta text
 * is measured on every tint a bubble can sit on, across all 7 themes x 2
 * modes. What the markup does (which layout rendered, when the toolbar mounts,
 * where the overlay lives, what a click on the toolbar does) is tested here.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Bubble, BubbleAuthor, BubbleMeta } from "../components/ui/bubble";
import { THEME_IDS } from "../theme/themePalettes";
import { composite, contrast } from "../theme/tokens/color";
import { buildRoles } from "../theme/tokens/roles";
import { MODES } from "../theme/tokens/tokenStyles";

const here = dirname(fileURLToPath(import.meta.url));

describe("Bubble layouts (the bubble-style preference)", () => {
    it("renders the row for compact and the balloon for bubble", () => {
        const { container, rerender } = render(<Bubble layout="compact">hi</Bubble>);
        expect(container.querySelector('[data-bubble-layout="compact"]')).not.toBeNull();
        expect(container.querySelector('[data-bubble-layout="bubble"]')).toBeNull();
        rerender(<Bubble layout="bubble">hi</Bubble>);
        expect(container.querySelector('[data-bubble-layout="bubble"]')).not.toBeNull();
        expect(container.querySelector('[data-bubble-layout="compact"]')).toBeNull();
    });

    it("keeps an empty avatar column for a grouped follow-up, and none otherwise", () => {
        const { container, rerender } = render(
            <Bubble avatar="reserve" layout="compact">
                body
            </Bubble>
        );
        // grid when there is a gutter, plain block when there is not
        const hasGrid = () =>
            Array.from(container.querySelectorAll("div")).some(
                (d) => getComputedStyle(d).display === "grid"
            );
        expect(hasGrid()).toBe(true);
        rerender(<Bubble layout="compact">body</Bubble>);
        expect(hasGrid()).toBe(false);
    });

    it("shows the header, body and footer in that order", () => {
        render(
            <Bubble
                avatar={<i>av</i>}
                footer={<p>foot</p>}
                header={<h3>head</h3>}
                layout="compact"
            >
                <p>body</p>
            </Bubble>
        );
        const text = document.body.textContent;
        expect(text).toBe("avheadbodyfoot");
    });

    it("stacked: the avatar sits in the header line", () => {
        const { container } = render(
            <Bubble
                align="stacked"
                avatar={<i data-testid="av">av</i>}
                header={<b data-testid="h">h</b>}
                layout="compact"
            >
                <p data-testid="b">b</p>
            </Bubble>
        );
        const av = screen.getByTestId("av");
        const h = screen.getByTestId("h");
        expect(av.parentElement?.parentElement).toBe(h.parentElement?.parentElement);
        expect(container.querySelector("p")).not.toBeNull();
    });
});

describe("Bubble actions toolbar", () => {
    it("is mounted only while actionsOpen when controlled", () => {
        const { rerender } = render(
            <Bubble actions={<button>act</button>} actionsOpen={false} layout="compact">
                x
            </Bubble>
        );
        expect(screen.queryByText("act")).toBeNull();
        rerender(
            <Bubble actions={<button>act</button>} actionsOpen layout="compact">
                x
            </Bubble>
        );
        expect(screen.getByText("act")).toBeTruthy();
    });

    it("is always mounted (CSS-revealed) when actionsOpen is left undefined", () => {
        render(
            <Bubble actions={<button>act</button>} layout="compact">
                x
            </Bubble>
        );
        expect(screen.getByText("act")).toBeTruthy();
    });

    it.each(["compact", "bubble"] as const)(
        "a click on the toolbar is not a click on the message (%s)",
        (layout) => {
            const onClick = vi.fn();
            const onDoubleClick = vi.fn();
            render(
                <Bubble
                    actions={<button>act</button>}
                    actionsOpen
                    layout={layout}
                    onClick={onClick}
                    onDoubleClick={onDoubleClick}
                >
                    body
                </Bubble>
            );
            fireEvent.click(screen.getByText("act"));
            fireEvent.doubleClick(screen.getByText("act"));
            expect(onClick).not.toHaveBeenCalled();
            expect(onDoubleClick).not.toHaveBeenCalled();
            fireEvent.click(screen.getByText("body"));
            expect(onClick).toHaveBeenCalledTimes(1);
        }
    );
});

describe("Bubble overlay (emoji picker, dialogs)", () => {
    it.each(["compact", "bubble"] as const)(
        "the %s layout hands the root ref to the right element",
        (layout) => {
            const ref = { current: null as HTMLElement | null };
            render(
                <Bubble layout={layout} overlay={<span data-testid="ov" />} rootRef={ref}>
                    body
                </Bubble>
            );
            expect(ref.current?.getAttribute("data-bubble-layout")).toBe(layout);
            // The picker anchors to, and outside-taps are measured against, the root.
            expect(ref.current?.contains(screen.getByTestId("ov"))).toBe(true);
        }
    );

    it("bubble layout keeps the overlay out of the clickable surface", () => {
        const onClick = vi.fn();
        render(
            <Bubble layout="bubble" overlay={<span data-testid="ov" />} onClick={onClick}>
                body
            </Bubble>
        );
        fireEvent.click(screen.getByTestId("ov"));
        expect(onClick).not.toHaveBeenCalled();
    });
});

describe("Bubble handlers", () => {
    it("passes the pointer and touch handlers through, in both layouts", () => {
        for (const layout of ["compact", "bubble"] as const) {
            const h = {
                onMouseEnter: vi.fn(),
                onMouseLeave: vi.fn(),
                onTouchCancel: vi.fn(),
                onTouchEnd: vi.fn(),
                onTouchMove: vi.fn(),
                onTouchStart: vi.fn(),
            };
            const { unmount } = render(
                <Bubble layout={layout} {...h}>
                    <span data-testid="b">body</span>
                </Bubble>
            );
            const el = screen.getByTestId("b");
            fireEvent.mouseEnter(el.parentElement as HTMLElement);
            fireEvent.touchStart(el);
            fireEvent.touchEnd(el);
            expect(h.onTouchStart).toHaveBeenCalled();
            expect(h.onTouchEnd).toHaveBeenCalled();
            unmount();
        }
    });
});

describe("Bubble meta", () => {
    it("renders author and meta text", () => {
        render(
            <>
                <BubbleAuthor>Ann</BubbleAuthor>
                <BubbleMeta>10:42</BubbleMeta>
            </>
        );
        expect(screen.getByText("Ann")).toBeTruthy();
        expect(screen.getByText("10:42")).toBeTruthy();
    });
});

describe("Bubble colors come from tokens", () => {
    it("has no literal color, no isDark branch and no gradient in its source", () => {
        const src = readFileSync(join(here, "../components/ui/bubble/Bubble.tsx"), "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*$/gm, "");
        expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(src).not.toMatch(/rgba?\(\s*\d/);
        expect(src).not.toMatch(/isDark|useColorScheme/);
        expect(src).not.toMatch(/gradient/);
        expect(src).not.toMatch(/--gp-/);
    });

    it("never reads a context or holds state (so the caller's memo boundary is the boundary)", () => {
        const src = readFileSync(join(here, "../components/ui/bubble/Bubble.tsx"), "utf8");
        expect(src).not.toMatch(/\buse(State|Context|Effect|Ref|Memo|Callback)\b/);
    });
});

describe.each(THEME_IDS.flatMap((id) => MODES.map((m) => [id, m] as const)))(
    "meta text on a bubble: %s / %s",
    (id, mode) => {
        const r = buildRoles(id as never, mode);
        // Every fill a bubble body can sit on: the surface, the sent tint, the
        // deep-link and open-thread tints, each also while hovered (a row).
        const tints = {
            accent: r.accentSubtle,
            success: r.success.subtle,
        };
        const base = { bg: r.bg, surface: r.surface };
        const fills = Object.fromEntries(
            Object.entries(base).flatMap(([bn, b]) => [
                [bn, b],
                [`${bn}+hover`, composite(r.hover.hex, r.hover.a, b)],
                ...Object.entries(tints).map(([tn, t]) => [
                    `${bn}+${tn}`,
                    composite(t.hex, t.a, b),
                ]),
            ])
        ) as Record<string, string>;

        it("tertiary meta passes 3:1 on every one", () => {
            const bad = Object.entries(fills)
                .map(([n, bg]) => ({ n, ratio: contrast(r.textTertiary, bg) }))
                .filter((x) => x.ratio < 3);
            expect(bad).toEqual([]);
        });

        it("body text passes AA on every one", () => {
            const bad = Object.entries(fills)
                .map(([n, bg]) => ({ n, ratio: contrast(r.text, bg) }))
                .filter((x) => x.ratio < 4.5);
            expect(bad).toEqual([]);
        });
    }
);
