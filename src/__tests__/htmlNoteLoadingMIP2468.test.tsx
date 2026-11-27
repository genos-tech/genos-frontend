// MIP-2468: the sandboxed frame stays invisible under the note loader until its page posts the
// nonce (or a timeout), instead of showing an empty white box. The loader is one element from the
// URL request to that moment. jsdom lays nothing out: the look is checked in a real browser.
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    HTML_NOTE_LOADED_GRACE_MS,
    HTML_NOTE_REVEAL_TIMEOUT_MS,
    HtmlNoteView,
} from "../features/notes/common/components/HtmlNoteView";
import { requestHtmlNoteReload } from "../features/notes/common/services/htmlNoteReload";
import { HTML_NOTE_LOADED_KEY } from "../features/notes/common/utils/htmlNote";
import { en } from "../i18n/locales/en";

const load = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("../features/notes/common/services/loadHtmlNote", () => ({
    loadHtmlNoteFrame: (...args: unknown[]) => load.fn(...args),
}));

const NONCE = "0123abcd0123abcd0123abcd0123abcd";

const tree = (noteId = 7, isActive = true) => (
    <CssVarsProvider>
        <HtmlNoteView
            accessToken="tok"
            isActive={isActive}
            noteId={noteId}
            noteType={1}
            title="Burndown"
        />
    </CssVarsProvider>
);

const settle = () => act(async () => void (await Promise.resolve()));
const advance = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));
const frame = () => document.querySelector("iframe") as HTMLIFrameElement;
const loader = () => screen.queryByRole("status", { name: en.notes.editor.loadingNote });
const post = (data: unknown, source: Window | null) =>
    act(() => {
        window.dispatchEvent(new MessageEvent("message", { data, source }));
    });
const confirm = () => post({ [HTML_NOTE_LOADED_KEY]: NONCE }, frame().contentWindow);
const covered = () => {
    expect(loader()?.getAttribute("aria-busy")).toBe("true");
    expect(frame().style.visibility).toBe("hidden");
    // never `display:none`: the page has to load underneath
    expect(frame().style.display).toBe("block");
};
const shown = () => {
    expect(loader()).toBeNull();
    expect(frame().style.visibility).toBe("visible");
};

beforeEach(() => {
    vi.useFakeTimers();
    load.fn.mockReset();
    load.fn.mockResolvedValue({ url: "https://api.example.test/h/tok-1", nonce: NONCE, rev: 1 });
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe("HTML note loading layer", () => {
    it("is one loader from the URL request until the page is shown", async () => {
        render(tree());
        const first = loader();
        expect(first).not.toBeNull();
        await settle();
        covered();
        // the same element: the dots do not restart and the caption is not announced twice
        expect(loader()).toBe(first);
        expect(screen.getAllByRole("status")).toHaveLength(1);
    });

    it("stays over the frame, also after its load event, until the nonce message", async () => {
        render(tree());
        await settle();
        fireEvent.load(frame());
        covered();
        post({ [HTML_NOTE_LOADED_KEY]: "not-the-nonce" }, frame().contentWindow);
        post({ [HTML_NOTE_LOADED_KEY]: NONCE }, window);
        covered();
        confirm();
        shown();
    });

    it("shows the frame anyway after the timeout", async () => {
        render(tree());
        await settle();
        await advance(HTML_NOTE_REVEAL_TIMEOUT_MS - 1);
        covered();
        await advance(1);
        shown();
    });

    it("still says the page navigated when a load is never confirmed", async () => {
        render(tree());
        await settle();
        fireEvent.load(frame());
        await advance(HTML_NOTE_LOADED_GRACE_MS);
        expect(screen.getByText(/tried to open another page/)).toBeTruthy();
        expect(loader()).toBeNull();
    });

    it("does not let the timeout uncover a page that loaded without confirming", async () => {
        render(tree());
        await settle();
        await advance(HTML_NOTE_REVEAL_TIMEOUT_MS - 100);
        fireEvent.load(frame());
        await advance(200);
        covered();
        await advance(HTML_NOTE_LOADED_GRACE_MS);
        expect(screen.getByText(/tried to open another page/)).toBeTruthy();
    });

    it("covers the frame again on reload", async () => {
        render(tree());
        await settle();
        confirm();
        shown();
        act(() => requestHtmlNoteReload(1, 7));
        expect(loader()).not.toBeNull();
        await settle();
        covered();
        confirm();
        shown();
    });

    it("covers the frame again for another note, and when the tab comes back", async () => {
        const { rerender } = render(tree());
        await settle();
        confirm();
        rerender(tree(8));
        await settle();
        covered();
        confirm();
        shown();

        rerender(tree(8, false));
        await settle();
        rerender(tree(8));
        await settle();
        covered();
    });
});
