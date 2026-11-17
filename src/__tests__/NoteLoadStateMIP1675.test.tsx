/**
 * MIP-1675. A note that has to come from the network (it is in neither the memory cache nor
 * IndexedDB) left its pane BLANK for as long as the fetch took: `NoteLoadState` rendered nothing
 * while loading, because an open that resolves in milliseconds must not flash a loader on every tab
 * switch (MIP-1276). It now shows the task page's pulsing dots and "Loading note…", but the dots,
 * the caption and the pane's own height are held back by CSS for `LOADING_INDICATOR_DELAY_MS`, so an
 * open that lands inside the delay paints and moves nothing: the rule a task SWITCH already follows.
 *
 * jsdom runs no animation, so the delay is pinned as the CSS the component emits; the pane in a real
 * browser (a slow open, and a fast one that must show nothing) is in the PR.
 */
import { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { LOADING_INDICATOR_DELAY_MS } from "../components/ui/misc/LoadingIndicator";
import { NoteLoadState } from "../features/notes/common/components/NoteLoadState";
import { en } from "../i18n/locales/en";

afterEach(cleanup);

const wrap = (node: ReactNode) => <CssVarsProvider>{node}</CssVarsProvider>;
const load = (over: Partial<Parameters<typeof NoteLoadState>[0]> = {}) =>
    render(wrap(<NoteLoadState error={false} isActive isLoading onRetry={vi.fn()} {...over} />));
const status = () => screen.getByRole("status", { name: en.notes.editor.loadingNote });

describe("while a note is loading", () => {
    it("says so: a status named 'Loading note…', marked busy", () => {
        load();
        expect(status().getAttribute("aria-busy")).toBe("true");
        expect(en.notes.editor.loadingNote).toBe("Loading note…");
    });

    it("draws the task page's dots and caption", () => {
        load();
        const [dots, caption] = Array.from(status().children);
        expect(dots.children).toHaveLength(3);
        expect(caption.textContent).toBe(en.notes.editor.loadingNote);
    });

    it("holds the dots and the caption invisible for the shared delay, so a fast open shows nothing", () => {
        load();
        const [dots, caption] = Array.from(status().children);
        for (const el of [dots, caption]) {
            const css = cssOf(el);
            expect(css).toMatch(
                new RegExp(`0\\.2s ease-out ${LOADING_INDICATOR_DELAY_MS}ms both`)
            );
            // Under reduced motion it is a 1ms step that keeps the same delay.
            expect(css).toMatch(new RegExp(`1ms linear ${LOADING_INDICATOR_DELAY_MS}ms both`));
        }
        expect(LOADING_INDICATOR_DELAY_MS).toBe(150);
    });

    it("claims the pane's height only once the dots can be seen (no layout shift for a fast open)", () => {
        load();
        const css = cssOf(status());
        expect(css).toMatch(new RegExp(`1ms linear ${LOADING_INDICATOR_DELAY_MS}ms both`));
        // The 240px minimum is the animation's END state, never a style from the first frame.
        expect(css).not.toMatch(/(^|[;{\s])min-height:\s*240px/);
        expect(css).not.toMatch(/(^|[;{\s])min-height:\s*[1-9]/);
    });

    it("in a host that fills the height (the mobile pool) it fills it at once and animates nothing", () => {
        load({ fillHeight: true });
        const css = cssOf(status());
        expect(css).toMatch(/flex:\s*1/);
        expect(css).not.toMatch(/animation:/);
    });

    it("is hidden with the inactive tab, like the editor and the error", () => {
        load({ isActive: false });
        // A hidden element has no accessible name, so look it up by its role alone.
        const el = screen.getByRole("status", { hidden: true });
        expect(getComputedStyle(el).display).toBe("none");
    });

    it("wins over a stale error: a Retry in flight shows the loader, not the old failure", () => {
        load({ error: true });
        expect(status()).toBeTruthy();
        expect(screen.queryByText(en.notes.editor.loadFailed)).toBeNull();
        expect(screen.queryByRole("button")).toBeNull();
    });
});

describe("when it is not loading", () => {
    it("renders nothing for a note that is neither loading nor failed", () => {
        const { container } = load({ isLoading: false });
        expect(container.textContent).toBe("");
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("a failed open is still the error with Retry", () => {
        const onRetry = vi.fn();
        load({ isLoading: false, error: true, onRetry });
        expect(screen.getByText(en.notes.editor.loadFailed)).toBeTruthy();
        expect(screen.queryByRole("status")).toBeNull();
    });
});

describe("the string", () => {
    it("is in every locale, as a real translation", async () => {
        const locales = await Promise.all(
            ["ja", "zh", "ar", "hi", "fr", "es"].map(
                async (l) => (await import(`../i18n/locales/${l}`))[l]
            )
        );
        for (const messages of locales) {
            expect(messages.notes.editor.loadingNote).toBeTruthy();
            expect(messages.notes.editor.loadingNote).not.toBe(en.notes.editor.loadingNote);
        }
    });
});
