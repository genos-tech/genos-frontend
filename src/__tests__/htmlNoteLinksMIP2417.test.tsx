// MIP-2417: links on a server-drawn page. The viewer opens a link only when the API said this
// revision is the server's (`links`), the message comes from its own frame with the nonce, and the
// path is one of the app's routes. A page a person or an AI app saved is never listened to.
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HtmlNoteView } from "../features/notes/common/components/HtmlNoteView";
import {
    HTML_NOTE_OPEN_KEY,
    HTML_NOTE_SANDBOX,
    isHtmlNotePageLink,
} from "../features/notes/common/utils/htmlNote";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";

const load = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("../features/notes/common/services/loadHtmlNote", () => ({
    loadHtmlNoteFrame: (...args: unknown[]) => load.fn(...args),
}));
const appUrl = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("../services/notifications/openAppUrl", () => ({ openAppUrl: appUrl.fn }));

const NONCE = "0123abcd0123abcd0123abcd0123abcd";
const TASK = "/workspace/tasks/project/3/task/9";
const openModalByHref = vi.fn();

const show = async (links: boolean, withModal = true) => {
    load.fn.mockResolvedValue({
        url: "https://api.example.test/h/tok-1",
        nonce: NONCE,
        rev: 1,
        size: 100,
        warnings: [],
        savedAt: "",
        links,
    });
    const view = <HtmlNoteView accessToken="tok" noteId={7} noteType={1} title="Board" isActive />;
    render(
        <CssVarsProvider>
            {withModal ? (
                <UrlLinkModalProvider value={{ openModalByHref }}>{view}</UrlLinkModalProvider>
            ) : (
                view
            )}
        </CssVarsProvider>
    );
    await act(async () => void (await Promise.resolve()));
    return document.querySelector("iframe") as HTMLIFrameElement;
};

const post = (source: MessageEventSource | null, data: unknown) =>
    act(() => {
        window.dispatchEvent(new MessageEvent("message", { data, source }));
    });

const click = (el: HTMLIFrameElement, path: unknown, nonce: unknown = NONCE) =>
    post(el.contentWindow, { [HTML_NOTE_OPEN_KEY]: path, nonce });

beforeEach(() => {
    load.fn.mockReset();
    openModalByHref.mockReset();
    appUrl.fn.mockReset();
});
afterEach(cleanup);

describe("links on a server-drawn page", () => {
    it("opens the clicked path in the app, and the sandbox is not loosened for it", async () => {
        const el = await show(true);
        expect(el.getAttribute("sandbox")).toBe("allow-scripts");
        expect(HTML_NOTE_SANDBOX).toBe("allow-scripts");
        click(el, TASK);
        expect(openModalByHref).toHaveBeenCalledWith(TASK);
        expect(appUrl.fn).not.toHaveBeenCalled();
    });

    it("falls back to a same-tab app navigation where no preview is mounted", async () => {
        const el = await show(true, false);
        click(el, TASK);
        expect(appUrl.fn).toHaveBeenCalledWith(TASK);
    });

    it("ignores every link of a page the server did not draw", async () => {
        const el = await show(false);
        click(el, TASK);
        expect(openModalByHref).not.toHaveBeenCalled();
        expect(appUrl.fn).not.toHaveBeenCalled();
    });

    it("ignores a message without the nonce, or from anywhere but its own frame", async () => {
        const el = await show(true);
        click(el, TASK, "guess");
        post(el.contentWindow, { [HTML_NOTE_OPEN_KEY]: TASK });
        post(window, { [HTML_NOTE_OPEN_KEY]: TASK, nonce: NONCE });
        post(null, { [HTML_NOTE_OPEN_KEY]: TASK, nonce: NONCE });
        post(el.contentWindow, TASK);
        post(el.contentWindow, null);
        expect(openModalByHref).not.toHaveBeenCalled();
    });

    it("opens nothing that is not one of the app's own routes", async () => {
        const el = await show(true);
        for (const bad of [
            "https://evil.example/x",
            "//evil.example",
            "javascript:alert(1)",
            "/workspace/../signin",
            "/workspace/tasks/project/1/../2",
            "/workspace/tasks/project/1?next=//evil",
            "/workspace/tasks/project/1#x",
            "/workspace/settings",
            "/signin",
            `${TASK}\n`,
            42,
        ]) {
            click(el, bad);
        }
        expect(openModalByHref).not.toHaveBeenCalled();
    });

    it("accepts every route shape the server writes", () => {
        const uuid = "6f1c2a9e-3b4d-4c5e-8f90-1a2b3c4d5e6f";
        for (const good of [
            "/workspace/tasks/project/3",
            TASK,
            "/workspace/tasks/project/3/milestone/4",
            "/workspace/notes/my/1",
            "/workspace/notes/team/1",
            "/workspace/notes/shared/1",
            "/workspace/notes/task/project/1/task/2/note/3",
            `/workspace/notes/chat/gm/${uuid}/thread/0/note/3`,
            `/workspace/notes/chat/dm/${uuid}/thread/${uuid}/note/3`,
        ]) {
            expect(isHtmlNotePageLink(good), good).toBe(true);
        }
    });
});
