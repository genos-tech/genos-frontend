// MIP-2215: the sandboxed frame. The attributes are the security boundary, so they are asserted
// exactly; the self-navigation guard (a second load, or a load our own document never confirmed)
// replaces the frame with a notice; Reload refetches and remounts; only the open note has a frame.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    HTML_NOTE_LOADED_GRACE_MS,
    HtmlNoteView,
} from "../features/notes/common/components/HtmlNoteView";
import { requestHtmlNoteReload } from "../features/notes/common/services/htmlNoteReload";
import { HTML_NOTE_LOADED_KEY } from "../features/notes/common/utils/htmlNote";

const load = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("../features/notes/common/services/loadHtmlNote", () => ({
    loadHtmlNoteFrame: (...args: unknown[]) => load.fn(...args),
}));

// MIP-2228: the viewer frames the API's own page URL; the nonce is the one the API handed out.
const NONCE = "0123abcd0123abcd0123abcd0123abcd";
const frameAnswer = (over: Record<string, unknown> = {}) => ({
    url: "https://api.example.test/h/tok-1",
    nonce: NONCE,
    rev: 1,
    size: 100,
    warnings: [],
    savedAt: "",
    ...over,
});

const renderView = (props: Partial<Parameters<typeof HtmlNoteView>[0]> = {}) =>
    render(
        <CssVarsProvider>
            <HtmlNoteView
                accessToken="tok"
                noteId={7}
                noteType={1}
                title="Burndown"
                isActive
                {...props}
            />
        </CssVarsProvider>
    );

const settle = () => act(async () => void (await Promise.resolve()));
const frame = () => document.querySelector("iframe") as HTMLIFrameElement | null;

/** What the server's sentinel posts from inside the frame: the nonce the API gave the viewer. */
const confirmFromFrame = (el: HTMLIFrameElement) => {
    act(() => {
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { [HTML_NOTE_LOADED_KEY]: NONCE },
                source: el.contentWindow,
            })
        );
    });
};

beforeEach(() => {
    vi.useFakeTimers();
    load.fn.mockReset();
    load.fn.mockResolvedValue(frameAnswer());
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe("HtmlNoteView frame", () => {
    it("is sandboxed with allow-scripts and nothing else, the API page URL, no referrer, lazy", async () => {
        renderView();
        await settle();
        const el = frame();
        expect(el).not.toBeNull();
        expect(el!.getAttribute("sandbox")).toBe("allow-scripts");
        expect(el!.getAttribute("referrerpolicy")).toBe("no-referrer");
        expect(el!.getAttribute("loading")).toBe("lazy");
        // MIP-2228: not a srcdoc (it would inherit the app's CSP and every script would be blocked)
        expect(el!.getAttribute("srcdoc")).toBeNull();
        expect(el!.getAttribute("src")).toBe("https://api.example.test/h/tok-1");
    });

    it("names the note's page in the frame title and says it is a sandboxed HTML page", async () => {
        renderView();
        await settle();
        expect(frame()!.getAttribute("title")).toContain("Burndown");
        expect(screen.getByText(/HTML page/)).toBeTruthy();
    });

    it("gives the frame the pane's width (a small margin), not the 50px note text margin (MIP-2315)", async () => {
        renderView();
        await settle();
        // jsdom does not evaluate the responsive (media query) values, so read the source
        const src = readFileSync(
            resolve(__dirname, "../features/notes/common/components/HtmlNoteView.tsx"),
            "utf8"
        );
        expect(src).toMatch(/FRAME_INSET = \{ xs: "12px", md: "16px" \}/);
        expect(src).toMatch(/marginX: FRAME_INSET/);
        // the host adds no side padding: only the title and label row keep the text inset
        expect(src).not.toMatch(/paddingX: \{ xs: "12px", md: "var\(--note-body-start/);
        expect(src.match(/paddingX: TEXT_INSET/g)).toHaveLength(2);
        await settle();
        const host = frame()!.parentElement!.parentElement as HTMLElement;
        expect(getComputedStyle(host).paddingLeft).toMatch(/^(0|0px|)$/);
    });

    it("asks for the URL of the note it was given", async () => {
        renderView({ noteType: 3, noteId: 42 });
        await settle();
        expect(load.fn).toHaveBeenCalledWith(3, 42, "tok", expect.anything());
    });

    it("has no frame at all while its note is not the open one", async () => {
        renderView({ isActive: false });
        await settle();
        expect(frame()).toBeNull();
        expect(load.fn).not.toHaveBeenCalled();
    });

    it("says it could not load the page, with a Retry, when the page is refused", async () => {
        load.fn.mockRejectedValue(new Error("404"));
        renderView();
        await settle();
        expect(frame()).toBeNull();
        expect(load.fn).toHaveBeenCalledTimes(1);
    });
});

// A browser fires the frame's FIRST `load` by itself once its page has arrived; jsdom does not fetch
// the frame's URL, so `mountLoaded` fires that first load, and a test's own `fireEvent.load` is the
// SECOND load.
const mountLoaded = async () => {
    renderView();
    await settle();
    const el = frame()!;
    fireEvent.load(el);
    return el;
};

describe("self-navigation guard", () => {
    it("keeps the frame when it loads once and its own document confirms it", async () => {
        const el = await mountLoaded();
        confirmFromFrame(el);
        await act(async () => void vi.advanceTimersByTime(HTML_NOTE_LOADED_GRACE_MS + 50));
        expect(frame()).not.toBeNull();
        expect(screen.queryByText(/tried to open another page/)).toBeNull();
    });

    it("replaces the frame when it loads a second time (it navigated itself after loading)", async () => {
        const el = await mountLoaded();
        confirmFromFrame(el);
        fireEvent.load(el);
        expect(frame()).toBeNull();
        expect(screen.getByText(/tried to open another page/)).toBeTruthy();
    });

    it("replaces the frame when its first load was never confirmed (it navigated while parsing)", async () => {
        await mountLoaded();
        expect(frame()).not.toBeNull();
        await act(async () => void vi.advanceTimersByTime(HTML_NOTE_LOADED_GRACE_MS + 50));
        expect(frame()).toBeNull();
        expect(screen.getByText(/tried to open another page/)).toBeTruthy();
    });

    it("ignores a message with the wrong nonce, or from another window", async () => {
        const el = await mountLoaded();
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { [HTML_NOTE_LOADED_KEY]: "not-the-nonce" },
                    source: el.contentWindow,
                })
            );
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { [HTML_NOTE_LOADED_KEY]: "anything" },
                    source: window,
                })
            );
        });
        await act(async () => void vi.advanceTimersByTime(HTML_NOTE_LOADED_GRACE_MS + 50));
        expect(frame()).toBeNull();
    });

    it("Reload from the notice fetches the page again and mounts a fresh frame", async () => {
        await mountLoaded();
        await act(async () => void vi.advanceTimersByTime(HTML_NOTE_LOADED_GRACE_MS + 50));
        expect(frame()).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: /Reload/ }));
        await settle();
        expect(load.fn).toHaveBeenCalledTimes(2);
        expect(frame()).not.toBeNull();
        expect(screen.queryByText(/tried to open another page/)).toBeNull();
    });
});

describe("Reload from the note's actions menu", () => {
    it("refetches only for the note it names", async () => {
        renderView({ noteType: 1, noteId: 7 });
        await settle();
        expect(load.fn).toHaveBeenCalledTimes(1);

        act(() => requestHtmlNoteReload(1, 8));
        await settle();
        expect(load.fn).toHaveBeenCalledTimes(1);

        act(() => requestHtmlNoteReload(2, 7));
        await settle();
        expect(load.fn).toHaveBeenCalledTimes(1);

        act(() => requestHtmlNoteReload(1, 7));
        await settle();
        expect(load.fn).toHaveBeenCalledTimes(2);
    });
});

// MIP-2228: the URL is good for ten minutes; a tab left and come back to must not load a dead one.
describe("the page URL's lifetime", () => {
    const tree = (isActive: boolean) => (
        <CssVarsProvider>
            <HtmlNoteView
                accessToken="tok"
                isActive={isActive}
                noteId={7}
                noteType={1}
                title="Burndown"
            />
        </CssVarsProvider>
    );

    it("asks once while the tab stays open, however often it re-renders", async () => {
        const { rerender } = render(tree(true));
        await settle();
        rerender(tree(true));
        await settle();
        expect(load.fn).toHaveBeenCalledTimes(1);
        expect(frame()!.getAttribute("src")).toBe("https://api.example.test/h/tok-1");
    });

    it("asks for a NEW url, and shows no frame meanwhile, each time the tab comes back", async () => {
        const { rerender } = render(tree(true));
        await settle();
        expect(frame()!.getAttribute("src")).toBe("https://api.example.test/h/tok-1");

        // the frame goes with the tab, and the URL it used was spent by that load
        rerender(tree(false));
        await settle();
        expect(frame()).toBeNull();

        load.fn.mockResolvedValueOnce(frameAnswer({ url: "https://api.example.test/h/tok-2" }));
        rerender(tree(true));
        // never a frame that holds the spent link, not even for one commit
        expect(frame()).toBeNull();
        await settle();
        expect(load.fn).toHaveBeenCalledTimes(2);
        expect(frame()!.getAttribute("src")).toBe("https://api.example.test/h/tok-2");
    });

    it("asks again when the same view is reused for another note", async () => {
        const { rerender } = render(tree(true));
        await settle();
        load.fn.mockResolvedValueOnce(frameAnswer({ url: "https://api.example.test/h/tok-9" }));
        rerender(
            <CssVarsProvider>
                <HtmlNoteView accessToken="tok" noteId={8} noteType={1} title="Other" isActive />
            </CssVarsProvider>
        );
        await settle();
        expect(load.fn).toHaveBeenCalledTimes(2);
        expect(load.fn).toHaveBeenLastCalledWith(1, 8, "tok", expect.anything());
        expect(frame()!.getAttribute("src")).toBe("https://api.example.test/h/tok-9");
    });
});
