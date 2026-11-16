/**
 * MIP-1650: someone who cannot edit a note can copy a link to one of its blocks.
 *
 * The drag-handle menu that offers "Copy link to block" to an editor (MIP-146) is BlockNote's side
 * menu, which BlockNote hides while the editor is read-only. A viewer gets a small button of its own:
 * it follows the pointer from block to block and only copies the link.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { useRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteLinkContext, type NoteLinkApi } from "../components/editors/sub/NoteLinkContext";
import { ReadOnlyBlockLinkButton } from "../components/editors/sub/ReadOnlyBlockLinkButton";

const copy = vi.fn(async () => true);
const api: NoteLinkApi = {
    blockLink: (id) => `https://app.example/workspace/notes/my/12?block=${id}`,
    commentLink: (id) => `https://app.example/workspace/notes/my/12?comment=${id}`,
    copy,
};

// A note body as BlockNote draws it: `data-id` on the outer wrapper AND on the block itself, and a
// child block inside its parent's container.
const Body = () => (
    <>
        <div data-id="b1" data-node-type="blockOuter">
            <div data-id="b1" data-node-type="blockContainer">
                <p data-testid="text-b1">first</p>
            </div>
        </div>
        <div data-id="b2" data-node-type="blockOuter">
            <div data-id="b2" data-node-type="blockContainer">
                <p data-testid="text-b2">parent</p>
                <div data-id="b3" data-node-type="blockOuter">
                    <div data-id="b3" data-node-type="blockContainer">
                        <p data-testid="text-b3">child</p>
                    </div>
                </div>
            </div>
        </div>
        <div data-testid="padding" />
    </>
);

const Harness = ({ link = api }: { link?: NoteLinkApi | null }) => {
    const ref = useRef<HTMLDivElement>(null);
    return (
        <NoteLinkContext.Provider value={link}>
            <div ref={ref} data-testid="box" style={{ position: "relative" }}>
                <Body />
                <ReadOnlyBlockLinkButton boxRef={ref} />
            </div>
        </NoteLinkContext.Provider>
    );
};

const button = () => screen.queryByRole("button", { name: "Copy link to block" });

beforeEach(() => {
    vi.useFakeTimers();
    copy.mockClear();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe("the read-only block link button", () => {
    it("is not there until the pointer is over a block", () => {
        render(<Harness />);
        expect(button()).toBeNull();
        fireEvent.mouseMove(screen.getByTestId("text-b1"));
        expect(button()).not.toBeNull();
    });

    it("copies the link to the block under the pointer, and nothing else", () => {
        render(<Harness />);
        fireEvent.mouseMove(screen.getByTestId("text-b1"));
        fireEvent.click(button()!);
        expect(copy).toHaveBeenCalledTimes(1);
        expect(copy).toHaveBeenCalledWith("https://app.example/workspace/notes/my/12?block=b1");
    });

    it("is one button: no drag handle, delete, colours or add-block", () => {
        render(<Harness />);
        fireEvent.mouseMove(screen.getByTestId("text-b1"));
        expect(screen.getAllByRole("button")).toHaveLength(1);
        for (const word of [/delete/i, /colou?rs/i, /reset/i, /add block/i]) {
            expect(screen.queryByText(word)).toBeNull();
        }
        expect(button()!.getAttribute("draggable")).not.toBe("true");
    });

    it("names the innermost block: a child under its parent, then the parent", () => {
        render(<Harness />);
        fireEvent.mouseMove(screen.getByTestId("text-b3"));
        fireEvent.click(button()!);
        expect(copy).toHaveBeenLastCalledWith(expect.stringContaining("?block=b3"));
        fireEvent.mouseMove(screen.getByTestId("text-b2"));
        fireEvent.click(button()!);
        expect(copy).toHaveBeenLastCalledWith(expect.stringContaining("?block=b2"));
    });

    it("moves from one block to the next without a gap", () => {
        render(<Harness />);
        fireEvent.mouseMove(screen.getByTestId("text-b1"));
        fireEvent.mouseMove(screen.getByTestId("text-b2"));
        expect(screen.getAllByRole("button")).toHaveLength(1);
        fireEvent.click(button()!);
        expect(copy).toHaveBeenLastCalledWith(expect.stringContaining("?block=b2"));
    });

    it("goes away shortly after the pointer leaves, and not before", () => {
        render(<Harness />);
        fireEvent.mouseMove(screen.getByTestId("text-b1"));
        fireEvent.mouseLeave(screen.getByTestId("box"));
        act(() => void vi.advanceTimersByTime(100));
        expect(button()).not.toBeNull();
        act(() => void vi.advanceTimersByTime(100));
        expect(button()).toBeNull();
    });

    it("stays while the pointer is on the button (the time to reach it)", () => {
        render(<Harness />);
        fireEvent.mouseMove(screen.getByTestId("text-b1"));
        fireEvent.mouseLeave(screen.getByTestId("box"));
        fireEvent.mouseMove(button()!);
        act(() => void vi.advanceTimersByTime(1000));
        expect(button()).not.toBeNull();
    });

    it("goes away over the space between blocks", () => {
        render(<Harness />);
        fireEvent.mouseMove(screen.getByTestId("text-b1"));
        fireEvent.mouseMove(screen.getByTestId("padding"));
        act(() => void vi.advanceTimersByTime(200));
        expect(button()).toBeNull();
    });

    it("goes away when the box scrolls (the blocks move under it)", () => {
        render(<Harness />);
        fireEvent.mouseMove(screen.getByTestId("text-b1"));
        fireEvent.scroll(screen.getByTestId("text-b1"));
        expect(button()).toBeNull();
    });

    it("offers nothing in a note with no page of its own (no link context)", () => {
        render(<Harness link={null} />);
        fireEvent.mouseMove(screen.getByTestId("text-b1"));
        expect(button()).toBeNull();
    });

    it("offers nothing when the note cannot make a link for that block", () => {
        render(<Harness link={{ ...api, blockLink: () => null }} />);
        fireEvent.mouseMove(screen.getByTestId("text-b1"));
        fireEvent.click(button()!);
        expect(copy).not.toHaveBeenCalled();
    });

    it("stops listening when it unmounts", () => {
        const view = render(<Harness />);
        const text = screen.getByTestId("text-b1");
        view.unmount();
        expect(() => fireEvent.mouseMove(text)).not.toThrow();
    });
});

// The editor wiring is asserted on the source, as the other editor guards in this suite do: jsdom
// cannot mount the whole collaborative editor.
describe("the note editor's wiring", () => {
    const source = readFileSync(
        resolve(
            dirname(fileURLToPath(import.meta.url)),
            "../components/editors/genos/GenosNoteEditor.tsx"
        ),
        "utf8"
    ).replace(/\s+/g, " ");

    it("offers the viewer button only when the note is NOT editable, inside the editor box", () => {
        expect(source).toContain(
            "{!isEditable && <ReadOnlyBlockLinkButton boxRef={editorBoxRef} />}"
        );
    });

    it("still keeps BlockNote's drag-handle side menu for editors only", () => {
        expect(source).toMatch(/\{isEditable && \( <SideMenuController/);
    });
});
