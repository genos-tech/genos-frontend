// MIP-2215: the sandboxed frame. The attributes are the security boundary, so they are asserted
// exactly; the self-navigation guard (a second load, or a load our own document never confirmed)
// replaces the frame with a notice; Reload refetches and remounts; only the open note has a frame.
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
    loadHtmlNote: (...args: unknown[]) => load.fn(...args),
}));

const PAGE =
    "<!doctype html><html><head><title>Burndown</title></head><body><h1>Hi</h1></body></html>";

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

/** What our sentinel posts from inside the frame: the nonce is the one in the frame's srcdoc. */
const confirmFromFrame = (el: HTMLIFrameElement) => {
    const nonce = /\("([0-9a-zA-Z-]+)"\)<\/script>/.exec(el.getAttribute("srcdoc") ?? "")?.[1];
    expect(nonce).toBeTruthy();
    act(() => {
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { [HTML_NOTE_LOADED_KEY]: nonce },
                source: el.contentWindow,
            })
        );
    });
};

beforeEach(() => {
    vi.useFakeTimers();
    load.fn.mockReset();
    load.fn.mockResolvedValue({
        html: PAGE,
        rev: 1,
        size: PAGE.length,
        warnings: [],
        savedAt: "",
    });
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe("HtmlNoteView frame", () => {
    it("is sandboxed with allow-scripts and nothing else, srcdoc, no referrer, lazy", async () => {
        renderView();
        await settle();
        const el = frame();
        expect(el).not.toBeNull();
        expect(el!.getAttribute("sandbox")).toBe("allow-scripts");
        expect(el!.getAttribute("referrerpolicy")).toBe("no-referrer");
        expect(el!.getAttribute("loading")).toBe("lazy");
        expect(el!.getAttribute("src")).toBeNull();
        const srcdoc = el!.getAttribute("srcdoc") ?? "";
        expect(
            srcdoc.startsWith('<!doctype html><meta http-equiv="Content-Security-Policy"')
        ).toBe(true);
        // the page itself follows our policy and our sentinel
        expect(srcdoc.indexOf("<h1>Hi</h1>")).toBeGreaterThan(
            srcdoc.indexOf("Content-Security-Policy")
        );
    });

    it("names the note's page in the frame title and says it is a sandboxed HTML page", async () => {
        renderView();
        await settle();
        expect(frame()!.getAttribute("title")).toContain("Burndown");
        expect(screen.getByText(/HTML page/)).toBeTruthy();
    });

    it("fetches the page of the note it was given", async () => {
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

// jsdom, like a browser, fires the frame's FIRST `load` by itself once the frame is in the document;
// `mountLoaded` lets that happen, so a test's own `fireEvent.load` is the SECOND load.
const mountLoaded = async () => {
    renderView();
    await settle();
    await act(async () => void vi.advanceTimersByTime(0));
    return frame()!;
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
