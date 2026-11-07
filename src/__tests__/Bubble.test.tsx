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
            <Bubble actions={<button>act</button>} layout="compact" actionsOpen>
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
                    layout={layout}
                    actionsOpen
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

    it("compact layout fences the overlay (a portal's click would reach the row)", () => {
        const onClick = vi.fn();
        const onDoubleClick = vi.fn();
        render(
            <Bubble
                layout="compact"
                overlay={<span data-testid="ov" />}
                onClick={onClick}
                onDoubleClick={onDoubleClick}
            >
                body
            </Bubble>
        );
        fireEvent.click(screen.getByTestId("ov"));
        fireEvent.doubleClick(screen.getByTestId("ov"));
        expect(onClick).not.toHaveBeenCalled();
        expect(onDoubleClick).not.toHaveBeenCalled();
    });
});

describe("Bubble hover", () => {
    it("bubble layout: moving from the balloon onto the toolbar is not leaving the message", () => {
        const onMouseLeave = vi.fn();
        render(
            <Bubble
                actions={<button>act</button>}
                layout="bubble"
                actionsOpen
                onMouseLeave={onMouseLeave}
            >
                <span data-testid="b">body</span>
            </Bubble>
        );
        const toolbar = screen.getByText("act").closest(".bubble-toolbar") as HTMLElement;
        fireEvent.mouseOut(screen.getByTestId("b"), { relatedTarget: toolbar });
        expect(onMouseLeave).not.toHaveBeenCalled();
        fireEvent.mouseOut(screen.getByTestId("b"), { relatedTarget: document.body });
        expect(onMouseLeave).toHaveBeenCalledTimes(1);
    });

    it("a button row is type=button (it must not submit a surrounding form)", () => {
        render(
            <Bubble component="button" layout="compact">
                row
            </Bubble>
        );
        expect(screen.getByText("row").closest("button")?.getAttribute("type")).toBe("button");
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

describe("Bubble: the body below md", () => {
    // jsdom does not apply media queries, but emotion writes the rules into the
    // document, so the CSS text of the body cell can be read.
    const cssOf = (el: Element) => {
        const cls = Array.from(el.classList).find((c) => c.startsWith("css-")) ?? "";
        return Array.from(document.querySelectorAll("style"))
            .map((s) => s.textContent ?? "")
            .join("")
            .split("}")
            .filter((r) => r.includes(`.${cls}`))
            .join("}");
    };
    const bodyCell = (narrowBody?: "below" | "beside") => {
        render(
            <Bubble avatar={<i>av</i>} header={<b>h</b>} layout="compact" narrowBody={narrowBody}>
                <p data-testid="body">body</p>
            </Bubble>
        );
        return screen.getByTestId("body").parentElement as HTMLElement;
    };

    it("by default the body spans the full width under the avatar on a phone", () => {
        expect(cssOf(bodyCell())).toContain("grid-column:1/-1");
    });

    it("beside keeps the body in the avatar's neighbouring column at every width (chat)", () => {
        const css = cssOf(bodyCell("beside"));
        expect(css).toContain("grid-column:2");
        expect(css).not.toContain("1/-1");
    });
});

describe("Bubble: a reserved avatar column", () => {
    const reservedCss = (narrowBody: "below" | "beside") => {
        const { container } = render(
            <Bubble avatar="reserve" header={<b>h</b>} layout="compact" narrowBody={narrowBody}>
                body
            </Bubble>
        );
        const cell = container.querySelector("[data-bubble-layout] > div > div") as HTMLElement;
        const cls = Array.from(cell.firstElementChild?.classList ?? []).find((c) =>
            c.startsWith("css-")
        );
        return Array.from(document.querySelectorAll("style"))
            .map((s) => s.textContent ?? "")
            .join("")
            .split("}")
            .filter((r) => r.includes(`.${cls}`))
            .join("}");
    };

    it("below md it is hidden where the body spans the full width (no blank row)", () => {
        expect(reservedCss("below")).toContain("display:none");
    });

    it("it stays where the body stays beside the avatar (chat's grouped follow-ups)", () => {
        expect(reservedCss("beside")).not.toContain("display:none");
    });
});

describe("Bubble toolbar side (bubble look)", () => {
    const toolbarCss = (side: "sent" | "received") => {
        const { unmount } = render(
            <Bubble actions={<button>act</button>} layout="bubble" side={side} actionsOpen>
                body
            </Bubble>
        );
        const tb = screen.getByText("act").closest(".bubble-toolbar") as HTMLElement;
        const cls = Array.from(tb.classList).find((c) => c.startsWith("css-"));
        const css = Array.from(document.querySelectorAll("style"))
            .map((s) => s.textContent ?? "")
            .join("")
            .split("}")
            .filter((r) => r.includes(`.${cls}`))
            .join("}");
        unmount();
        return css;
    };

    // The toolbar is wider than a short balloon: it must open into the empty
    // side or it spills past the list's edge (seen in a real chat).
    it("a received balloon opens it toward the end, a sent one toward the start", () => {
        expect(toolbarCss("received")).toContain("inset-inline-start");
        expect(toolbarCss("received")).not.toContain("inset-inline-end");
        expect(toolbarCss("sent")).toContain("inset-inline-end");
        expect(toolbarCss("sent")).not.toContain("inset-inline-start");
    });
});

describe("Bubble actions at the bottom (the Genos answer)", () => {
    const css = (el: Element) => {
        // The reveal rules live on an ancestor (the root), keyed by class.
        const root = el.closest("[data-bubble-layout]") as HTMLElement;
        const cls = Array.from(root.classList).find((c) => c.startsWith("css-"));
        return Array.from(document.querySelectorAll("style"))
            .map((s) => s.textContent ?? "")
            .join("")
            .split("}")
            .filter((r) => r.includes(`.${cls}`))
            .join("}");
    };

    it.each(["compact", "bubble"] as const)(
        "%s: the row comes after the body, is not the floating toolbar, and is in the frame",
        (layout) => {
            const { container } = render(
                <Bubble actions={<button>act</button>} actionsPosition="bottom" layout={layout}>
                    <p>the body</p>
                </Bubble>
            );
            const row = screen.getByText("act").closest(".bubble-actions-bottom") as HTMLElement;
            expect(row).toBeTruthy();
            expect(container.querySelector(".bubble-toolbar")).toBeNull();
            const body = screen.getByText("the body");
            expect(
                body.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy();
            // In the clickable surface for the balloon, in the row for compact.
            const frame = container.querySelector("[data-bubble-layout]") as HTMLElement;
            expect(frame.contains(row)).toBe(true);
        }
    );

    it("is revealed by CSS on hover / focus / touch (no hover state held by the caller)", () => {
        render(
            <Bubble actions={<button>act</button>} actionsPosition="bottom" layout="compact">
                body
            </Bubble>
        );
        const rules = css(screen.getByText("act"));
        expect(rules).toContain(".bubble-actions-bottom");
        expect(rules).toContain(":hover");
        expect(rules).toContain(":focus-within");
        expect(rules).toContain("(hover: none)");
    });

    it("renders nothing without actions, and nothing while a controlled bar is closed", () => {
        const { container, rerender } = render(
            <Bubble actionsPosition="bottom" layout="compact">
                body
            </Bubble>
        );
        expect(container.querySelector(".bubble-actions-bottom")).toBeNull();
        rerender(
            <Bubble
                actions={<button>act</button>}
                actionsOpen={false}
                actionsPosition="bottom"
                layout="bubble"
            >
                body
            </Bubble>
        );
        expect(container.querySelector(".bubble-actions-bottom")).toBeNull();
    });

    it("the default stays the floating toolbar (every other surface is unchanged)", () => {
        const { container } = render(
            <Bubble actions={<button>act</button>} layout="compact">
                body
            </Bubble>
        );
        expect(container.querySelector(".bubble-toolbar")).toBeTruthy();
        expect(container.querySelector(".bubble-actions-bottom")).toBeNull();
    });
});
