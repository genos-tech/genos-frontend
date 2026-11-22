import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TabStrip } from "../components/ui/feedback/TabStrip";

// MIP-1982: while the strip can scroll sideways, the edge with more tabs behind it fades, and the
// fade goes at the end of the scroll. A strip that fits shows no cue. jsdom has no layout, so the
// element's sizes are set by hand and a scroll event asks the strip to measure again.

const tabs = [
    { id: "a", label: "Today" },
    { id: "b", label: "Project" },
    { id: "c", label: "Milestones" },
];

const mount = () =>
    render(
        <CssVarsProvider>
            <TabStrip ariaLabel="Sections" tabs={tabs} value="a" onChange={vi.fn()} />
        </CssVarsProvider>
    );

const size = (el: HTMLElement, scrollWidth: number, clientWidth: number, scrollLeft: number) => {
    Object.defineProperty(el, "scrollWidth", { configurable: true, value: scrollWidth });
    Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
    Object.defineProperty(el, "scrollLeft", {
        configurable: true,
        value: scrollLeft,
        writable: true,
    });
    act(() => {
        fireEvent.scroll(el);
    });
};

describe("TabStrip overflow cue (MIP-1982)", () => {
    it("shows no cue when every tab fits", () => {
        mount();
        const list = screen.getByRole("tablist");
        size(list, 200, 200, 0);
        expect(list.getAttribute("data-overflow-start")).toBeNull();
        expect(list.getAttribute("data-overflow-end")).toBeNull();
    });

    it("fades the end while tabs wait past it, both edges in the middle, the start at the end", () => {
        mount();
        const list = screen.getByRole("tablist");
        size(list, 500, 200, 0);
        expect(list.getAttribute("data-overflow-end")).toBe("true");
        expect(list.getAttribute("data-overflow-start")).toBeNull();
        size(list, 500, 200, 120);
        expect(list.getAttribute("data-overflow-end")).toBe("true");
        expect(list.getAttribute("data-overflow-start")).toBe("true");
        size(list, 500, 200, 300);
        expect(list.getAttribute("data-overflow-end")).toBeNull();
        expect(list.getAttribute("data-overflow-start")).toBe("true");
    });

    it("reads right-to-left scrolling (negative scrollLeft) the same way", () => {
        mount();
        const list = screen.getByRole("tablist");
        size(list, 500, 200, -120);
        expect(list.getAttribute("data-overflow-start")).toBe("true");
        expect(list.getAttribute("data-overflow-end")).toBe("true");
        size(list, 500, 200, -300);
        expect(list.getAttribute("data-overflow-end")).toBeNull();
    });
});
