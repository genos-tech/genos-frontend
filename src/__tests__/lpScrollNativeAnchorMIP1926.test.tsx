/**
 * MIP-1926: a plain `<a href="#x">` (TOC link, skip link) pushes a history entry with no state,
 * which React Router keys "default", the same key as the first page loaded. The scroll hook took
 * that jump for Back/Forward and restored the first page's position, then saved the anchor's
 * position under the first page's key. Entries with the "default" key are now keyed by URL too.
 */
import { act, render, waitFor } from "@testing-library/react";
import { BrowserRouter, Link } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLpScrollReset } from "../lp/kit/useLpScrollReset";

// `fire: false` moves the window without a scroll event, as a native anchor jump does before the
// browser's (async) scroll event arrives.
const setScrollY = (y: number, fire = true) => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });
    if (fire) window.dispatchEvent(new Event("scroll"));
};

function Probe() {
    useLpScrollReset();
    return (
        <div>
            <Link to="/developers-b">to developers</Link>
            <main id="lp-main" tabIndex={-1} />
            <div id="rest" />
        </div>
    );
}

let scrollTo: ReturnType<typeof vi.fn>;
beforeEach(() => {
    scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    Element.prototype.scrollIntoView = vi.fn();
    setScrollY(0);
});
afterEach(() => {
    window.history.replaceState(null, "", "/");
});

const tops = () => scrollTo.mock.calls.map((c) => (c[0] as { top: number }).top);

describe("native #anchor on a stateless history entry (MIP-1926)", () => {
    it("is not taken for Back/Forward: the saved position of the first page is not restored", async () => {
        window.history.replaceState(null, "", "/developers-a");
        render(
            <BrowserRouter>
                <Probe />
            </BrowserRouter>
        );
        setScrollY(300);
        scrollTo.mockClear();

        await act(async () => {
            window.history.pushState(null, "", "/developers-a#auth");
            setScrollY(5000, false);
            window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
        });

        expect(tops()).not.toContain(300);
    });

    it("Back twice after a native anchor lands on the first page's own position", async () => {
        window.history.replaceState(null, "", "/home-a");
        const { getByText } = render(
            <BrowserRouter>
                <Probe />
            </BrowserRouter>
        );
        setScrollY(3000);

        // Link: a router entry (has a state key), lands at the top.
        await act(async () => {
            getByText("to developers").click();
        });
        setScrollY(0);
        // Native anchor on that page: no state, key "default".
        await act(async () => {
            window.history.pushState(null, "", "/developers-b#rest");
            setScrollY(800, false);
            window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
        });
        scrollTo.mockClear();

        // Back twice, to the first page.
        await act(async () => {
            window.history.back();
        });
        await waitFor(() =>
            expect(window.location.pathname + window.location.hash).toBe("/developers-b")
        );
        await act(async () => {
            window.history.back();
        });
        await waitFor(() => expect(window.location.pathname).toBe("/home-a"));

        await waitFor(() => expect(tops()).toContain(3000));
    });
});
