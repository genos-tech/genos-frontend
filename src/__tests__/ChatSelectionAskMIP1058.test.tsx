/**
 * The "Ask Genos" button next to text selected inside one chat message (MIP-1058), and what reads that
 * selection. jsdom has no layout, so a Range's rectangle is stubbed; what is tested is the logic: which
 * selections count, when the button shows and goes, what a click hands over, and that it does not
 * listen to the whole app.
 */

import { createRef } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteModalHostZIndexProvider } from "../components/modals/noteModalHostZIndex";
import { ChatSelectionAsk } from "../features/chat/components/shared/ChatSelectionAsk";
import { askMessageProps, readMessageSelection } from "../features/chat/utils/messageSelection";
import { onAskGenosAboutSelection } from "../features/spotlight/askGenosAbout";
import { en } from "../i18n/locales/en";

const A = "5b0c3a52-6a31-4f1a-9a30-0e7f4a8f1c11";
const B = "9d3a1b64-2c57-4c0e-8b5e-3f1a2b6c7d88";

const realRect = Range.prototype.getBoundingClientRect;
beforeAll(() => {
    Range.prototype.getBoundingClientRect = () =>
        ({ top: 200, bottom: 216, left: 100, right: 180, width: 80, height: 16 }) as DOMRect;
});
afterAll(() => {
    Range.prototype.getBoundingClientRect = realRect;
});

const attrs = (id: string) =>
    Object.entries(askMessageProps(id))
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");

/** A message list with two messages, a header outside any body, and an editable field. */
const mountList = () => {
    document.body.innerHTML = `
        <div id="list">
            <div id="m1"><span id="who">Alice</span><div id="b1" ${attrs(A)}><p id="p1">ship it on <b id="bold">Friday</b> please</p></div></div>
            <div id="m2"><div id="b2" ${attrs(B)}><p id="p2">second message</p></div></div>
            <div id="legacy"><div id="b3" data-ask-message-id="42-12"><p id="p3">legacy row</p></div></div>
            <div id="editing" ${attrs(A)}><div contenteditable="true" id="edit">being edited</div></div>
        </div>
        <div id="outside"><div ${attrs(A)}><p id="p4">outside the list</p></div></div>`;
};

const select = (from: string, to: string, fromOffset = 0, toOffset?: number) => {
    const a = document.getElementById(from)!;
    const b = document.getElementById(to)!;
    const range = document.createRange();
    // With explicit offsets the selection is inside the FIRST text node; without, it runs to the end.
    range.setStart(a.firstChild ?? a, fromOffset);
    if (toOffset !== undefined) range.setEnd(b.firstChild ?? b, toOffset);
    else range.setEnd(b.lastChild ?? b, b.lastChild?.textContent?.length ?? 0);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
};

const mountButton = () => {
    mountList();
    const ref = createRef<HTMLElement>();
    const holder = document.createElement("div");
    document.body.appendChild(holder);
    (ref as { current: HTMLElement | null }).current = document.getElementById("list");
    render(
        <CssVarsProvider>
            <ChatSelectionAsk containerRef={ref} />
        </CssVarsProvider>,
        { container: holder }
    );
    return ref.current!;
};

const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 5))));
// A selection is made by a press in the list and its release; the release is heard once on the
// document, for that press.
const mouseUp = (el: Element, detail = 1) => {
    fireEvent.mouseDown(el, { detail });
    fireEvent.mouseUp(el, { detail });
};

beforeEach(() => {
    window.matchMedia = ((q: string) => ({
        matches: false,
        media: q,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
        onchange: null,
    })) as never;
});
afterEach(() => {
    cleanup();
    window.getSelection()?.removeAllRanges();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
});

describe("which selections count", () => {
    it("one inside a message body: the message and the text", () => {
        mountList();
        select("p1", "p1", 0, 6);
        const found = readMessageSelection();
        expect(found?.messageId).toBe(A);
        expect(found?.text).toBe("ship i");
    });

    it("one that spans inline formatting inside the same body still counts", () => {
        mountList();
        select("p1", "p1");
        expect(readMessageSelection()?.text).toBe("ship it on Friday please");
    });

    it("none when collapsed", () => {
        mountList();
        select("p1", "p1", 2, 2);
        expect(readMessageSelection()).toBeNull();
    });

    it("none when it runs from one message into another", () => {
        mountList();
        select("p1", "p2");
        expect(readMessageSelection()).toBeNull();
    });

    it("none when it starts in the header, outside every body", () => {
        mountList();
        select("who", "p1");
        expect(readMessageSelection()).toBeNull();
    });

    it("none for a body whose id is not a v3 uuid (legacy row)", () => {
        mountList();
        select("p3", "p3");
        expect(readMessageSelection()).toBeNull();
    });

    it("none inside an editable field", () => {
        mountList();
        select("edit", "edit");
        expect(readMessageSelection()).toBeNull();
    });

    it("`only` limits it to one message", () => {
        mountList();
        select("p1", "p1");
        expect(readMessageSelection(A)?.messageId).toBe(A);
        expect(readMessageSelection(B)).toBeNull();
    });

    it("a message without a v3 id wears no mark at all", () => {
        expect(askMessageProps("42-12")).toEqual({});
        expect(askMessageProps(undefined)).toEqual({});
        expect(askMessageProps(A)).toEqual({ "data-ask-message-id": A });
    });
});

describe("the button", () => {
    it("shows after a selection inside a message, named for a screen reader", async () => {
        const list = mountButton();
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();
        select("p1", "p1", 0, 6);
        mouseUp(list.querySelector("#p1")!);
        await settle();
        const button = screen.getByTestId("chat-selection-ask");
        expect(button.getAttribute("aria-label")).toBe(en.chat.messageActions.askGenosSelection);
        expect(button.textContent).toBe(en.chat.messageActions.askGenosShort);
        // Outside the message DOM: it can never become part of a selection.
        expect(list.contains(button)).toBe(false);
    });

    it("a click hands the passage over with its message as the source, then clears the selection", async () => {
        const list = mountButton();
        select("p1", "p1", 0, 6);
        mouseUp(list.querySelector("#p1")!);
        await settle();
        const heard = vi.fn();
        const off = onAskGenosAboutSelection(heard);
        fireEvent.click(screen.getByTestId("chat-selection-ask"));
        off();
        expect(heard).toHaveBeenCalledWith({
            text: "ship i",
            from: { kind: "message", messageId: A, label: "" },
        });
        expect(window.getSelection()?.isCollapsed).toBe(true);
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();
    });

    it("keeps the selection alive while it is pressed (mousedown is not allowed to collapse it)", async () => {
        const list = mountButton();
        select("p1", "p1", 0, 6);
        mouseUp(list.querySelector("#p1")!);
        await settle();
        const notPrevented = fireEvent.mouseDown(screen.getByTestId("chat-selection-ask"));
        expect(notPrevented).toBe(false); // preventDefault was called
    });

    it("is not offered for a double or triple click (a double-click adds the message to the To-Do)", async () => {
        const list = mountButton();
        select("p1", "p1", 0, 4);
        mouseUp(list.querySelector("#p1")!, 2);
        await settle();
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();
        mouseUp(list.querySelector("#p1")!, 3);
        await settle();
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();
    });

    it("is offered when the drag is released OUTSIDE the list (past the edge, over the composer)", async () => {
        const list = mountButton();
        fireEvent.mouseDown(list.querySelector("#p1")!);
        select("p1", "p1", 0, 6);
        fireEvent.mouseUp(document.getElementById("outside")!);
        await settle();
        expect(screen.getByTestId("chat-selection-ask")).toBeTruthy();
    });

    it("a double click does not stop the next drag from being offered", async () => {
        const list = mountButton();
        select("p1", "p1", 0, 4);
        mouseUp(list.querySelector("#p1")!, 2);
        await settle();
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();
        select("p1", "p1", 0, 6);
        mouseUp(list.querySelector("#p1")!, 1);
        await settle();
        expect(screen.getByTestId("chat-selection-ask")).toBeTruthy();
    });

    it("is not offered for a selection across messages, in a header, or in the composer", async () => {
        const list = mountButton();
        select("p1", "p2");
        mouseUp(list.querySelector("#p1")!);
        await settle();
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();
        select("who", "p1");
        mouseUp(list.querySelector("#who")!);
        await settle();
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();
        select("edit", "edit");
        mouseUp(list.querySelector("#edit")!);
        await settle();
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();
    });

    it("is not offered for a selection in another list", async () => {
        const list = mountButton();
        select("p4", "p4");
        mouseUp(list.querySelector("#p1")!);
        await settle();
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();
    });

    it("is not offered on a touch screen: the browser's own handles and the message menu are there", async () => {
        window.matchMedia = ((q: string) => ({
            matches: q.includes("coarse"),
            media: q,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
            dispatchEvent: () => false,
            onchange: null,
        })) as never;
        const list = mountButton();
        select("p1", "p1", 0, 6);
        mouseUp(list.querySelector("#p1")!);
        await settle();
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();
    });

    it("goes when the selection goes, when Escape is pressed, and when a new press starts", async () => {
        const list = mountButton();
        select("p1", "p1", 0, 6);
        mouseUp(list.querySelector("#p1")!);
        await settle();
        expect(screen.getByTestId("chat-selection-ask")).toBeTruthy();
        // The selection collapses (a click elsewhere): the document's own event.
        window.getSelection()!.removeAllRanges();
        await act(async () => void document.dispatchEvent(new Event("selectionchange")));
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();

        select("p1", "p1", 0, 6);
        mouseUp(list.querySelector("#p1")!);
        await settle();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();

        select("p1", "p1", 0, 6);
        mouseUp(list.querySelector("#p1")!);
        await settle();
        fireEvent.mouseDown(list.querySelector("#p1")!);
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();
    });

    it("sits above the selection, and below it when there is no room above", async () => {
        const list = mountButton();
        select("p1", "p1", 0, 6);
        mouseUp(list.querySelector("#p1")!);
        await settle();
        const style = () => getComputedStyle(screen.getByTestId("chat-selection-ask"));
        expect(style().transform).toContain("-100%");
        Range.prototype.getBoundingClientRect = () =>
            ({ top: 4, bottom: 20, left: 100, right: 180, width: 80, height: 16 }) as DOMRect;
        select("p1", "p1", 0, 5);
        mouseUp(list.querySelector("#p1")!);
        await settle();
        expect(style().transform).not.toContain("-100%");
    });
});

describe("inside a link-preview modal", () => {
    it("is never offered: it would sit under the modal, and Spotlight could not take focus over it", async () => {
        mountList();
        const list = document.getElementById("list")!;
        const holder = document.createElement("div");
        document.body.appendChild(holder);
        render(
            <CssVarsProvider>
                <NoteModalHostZIndexProvider value={10020}>
                    <ChatSelectionAsk containerRef={{ current: list }} />
                </NoteModalHostZIndexProvider>
            </CssVarsProvider>,
            { container: holder }
        );
        select("p1", "p1", 0, 6);
        mouseUp(list.querySelector("#p1")!);
        await settle();
        expect(screen.queryByTestId("chat-selection-ask")).toBeNull();
    });
});

describe("it does not listen to the whole app", () => {
    it("adds no selectionchange listener until it is showing, and removes it when it goes", async () => {
        const add = vi.spyOn(document, "addEventListener");
        const remove = vi.spyOn(document, "removeEventListener");
        const list = mountButton();
        const changes = (spy: typeof add) =>
            spy.mock.calls.filter(([t]) => t === "selectionchange");
        // Mounted and idle: nothing on the document.
        expect(changes(add)).toHaveLength(0);

        select("p1", "p1", 0, 6);
        mouseUp(list.querySelector("#p1")!);
        await settle();
        expect(changes(add)).toHaveLength(1);
        expect(changes(remove)).toHaveLength(0);

        window.getSelection()!.removeAllRanges();
        await act(async () => void document.dispatchEvent(new Event("selectionchange")));
        expect(changes(remove)).toHaveLength(1);
    });

    it("listens on the list for a press and on the window for nothing", () => {
        const addWindow = vi.spyOn(window, "addEventListener");
        mountButton();
        expect(
            addWindow.mock.calls.filter(([t]) => t === "mouseup" || t === "mousedown")
        ).toHaveLength(0);
    });

    it("hears the release on the document only after a press in the list, once", async () => {
        const add = vi.spyOn(document, "addEventListener");
        const remove = vi.spyOn(document, "removeEventListener");
        const list = mountButton();
        const ups = (spy: typeof add) => spy.mock.calls.filter(([t]) => t === "mouseup");
        expect(ups(add)).toHaveLength(0);
        fireEvent.mouseDown(list.querySelector("#p1")!);
        expect(ups(add)).toHaveLength(1);
        fireEvent.mouseUp(document.body);
        await settle();
        // `once`: the browser drops it on its own after the release.
        expect((ups(add)[0][2] as AddEventListenerOptions).once).toBe(true);
        // A press elsewhere (outside the list) adds nothing.
        fireEvent.mouseDown(document.getElementById("outside")!);
        expect(ups(add)).toHaveLength(1);
        expect(ups(remove)).toHaveLength(0);
    });

    it("removes its list listener, and a release still pending, when it unmounts", () => {
        mountList();
        const list = document.getElementById("list")!;
        const removeList = vi.spyOn(list, "removeEventListener");
        const removeDoc = vi.spyOn(document, "removeEventListener");
        const view = render(
            <CssVarsProvider>
                <ChatSelectionAsk containerRef={{ current: list }} />
            </CssVarsProvider>
        );
        fireEvent.mouseDown(list.querySelector("#p1")!);
        view.unmount();
        expect(removeList.mock.calls.map(([t]) => t)).toEqual(["mousedown"]);
        expect(removeDoc.mock.calls.some(([t]) => t === "mouseup")).toBe(true);
    });
});
