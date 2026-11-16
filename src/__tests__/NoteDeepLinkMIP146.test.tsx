/**
 * MIP-146: opening a block or comment link acts on it once the note can show it.
 *
 * A note syncs its blocks from the Yjs document AFTER the editor mounts, and an editor kept alive
 * in the pool can be hidden, so the hook looks until the block (or thread) is there and on screen,
 * acts once, and gives up with a message. The editor is a small fake with a real DOM element.
 */
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    HIGHLIGHT_CLASS,
    HIGHLIGHT_MS,
    POLL_MS,
    useNoteDeepLink,
    WAIT_MS,
    type DeepLinkEditor,
} from "../components/editors/sub/useNoteDeepLink";
import { ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts } from "../components/ui/feedback/toastStore";
import { useCaptureNoteTarget } from "../features/notes/common/hooks/useCaptureNoteTarget";
import {
    peekNoteTarget,
    resetNoteTarget,
    setNoteTarget,
} from "../features/notes/common/utils/noteTarget";

const BLOCK = "6c1c0a52-2a36-4a2f-93cb-0d1a1b6f8c11";
const THREAD = "0e51b6f1-aaaa-4bbb-8ccc-ddddeeeeffff";
const NOTE = { noteType: 1 as const, noteId: 12 };

type Fake = {
    editor: DeepLinkEditor;
    root: HTMLElement;
    blocks: Set<string>;
    selected: string[];
};

const makeEditor = (): Fake => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const blocks = new Set<string>();
    const selected: string[] = [];
    return {
        root,
        blocks,
        selected,
        editor: {
            getBlock: (id) => (blocks.has(id) ? { id } : undefined),
            domElement: root,
            selectThread: (id) => selected.push(id),
        },
    };
};

/** A block element in the editor DOM; `shown` decides whether it has layout. */
const addBlock = (fake: Fake, id: string, shown = true) => {
    const el = document.createElement("div");
    // As BlockNote renders it: the wrapper and the block both carry the id; only the block counts.
    const outer = document.createElement("div");
    outer.className = "bn-block-outer";
    outer.setAttribute("data-node-type", "blockOuter");
    outer.setAttribute("data-id", id);
    el.className = "bn-block";
    el.setAttribute("data-node-type", "blockContainer");
    el.setAttribute("data-id", id);
    outer.appendChild(el);
    el.getClientRects = () =>
        shown ? ([{}] as unknown as DOMRectList) : ([] as unknown as DOMRectList);
    el.scrollIntoView = vi.fn();
    fake.root.appendChild(outer);
    fake.blocks.add(id);
    return el;
};

const Probe = ({
    editor,
    getThreads = null,
    note = NOTE,
}: {
    editor: DeepLinkEditor | null;
    getThreads?: (() => ReadonlyMap<string, { deletedAt?: unknown }>) | null;
    note?: typeof NOTE;
}) => {
    useNoteDeepLink({ editor, getThreads, note });
    return <ToastHost />;
};

const tick = async (ms: number) => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
};

beforeEach(() => {
    vi.useFakeTimers();
    resetNoteTarget();
    __resetToasts();
});
afterEach(() => {
    document.body.innerHTML = "";
    resetNoteTarget();
    vi.useRealTimers();
});

describe("a block link", () => {
    it("scrolls to the block, highlights it for a few seconds, then lets go", async () => {
        const fake = makeEditor();
        const el = addBlock(fake, BLOCK);
        render(<Probe editor={fake.editor} />);
        expect(el.scrollIntoView).not.toHaveBeenCalled(); // no target, nothing happens

        act(() => setNoteTarget({ ...NOTE, blockId: BLOCK }));
        await tick(0);

        expect(el.scrollIntoView).toHaveBeenCalledWith(
            expect.objectContaining({ block: "center" })
        );
        expect(el.classList.contains(HIGHLIGHT_CLASS)).toBe(true);
        // The block itself, not BlockNote's outer wrapper that carries the same data-id.
        expect(el.parentElement?.classList.contains(HIGHLIGHT_CLASS)).toBe(false);
        await tick(HIGHLIGHT_MS - 1);
        expect(el.classList.contains(HIGHLIGHT_CLASS)).toBe(true);
        await tick(1);
        expect(el.classList.contains(HIGHLIGHT_CLASS)).toBe(false);
    });

    it("consumes the target, so it acts once and not again on the next render", async () => {
        const fake = makeEditor();
        const el = addBlock(fake, BLOCK);
        const view = render(<Probe editor={fake.editor} />);
        act(() => setNoteTarget({ ...NOTE, blockId: BLOCK }));
        await tick(0);
        expect(peekNoteTarget()).toBeNull();
        view.rerender(<Probe editor={fake.editor} />);
        await tick(POLL_MS * 4);
        expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it("waits for a block that has not synced yet, then acts as soon as it appears", async () => {
        const fake = makeEditor();
        render(<Probe editor={fake.editor} />);
        act(() => setNoteTarget({ ...NOTE, blockId: BLOCK }));
        await tick(POLL_MS * 6);
        expect(peekNoteTarget()).not.toBeNull(); // still waiting, no error yet

        const el = addBlock(fake, BLOCK);
        await tick(POLL_MS);
        expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
        expect(peekNoteTarget()).toBeNull();
    });

    it("waits while the editor is hidden (an editor kept alive in the pool)", async () => {
        const fake = makeEditor();
        const el = addBlock(fake, BLOCK, false);
        render(<Probe editor={fake.editor} />);
        act(() => setNoteTarget({ ...NOTE, blockId: BLOCK }));
        await tick(POLL_MS * 4);
        expect(el.scrollIntoView).not.toHaveBeenCalled();

        el.getClientRects = () => [{}] as unknown as DOMRectList;
        await tick(POLL_MS);
        expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it("says so, and drops the target, when the block is not in the note", async () => {
        const fake = makeEditor();
        render(<Probe editor={fake.editor} />);
        act(() => setNoteTarget({ ...NOTE, blockId: BLOCK }));
        await tick(WAIT_MS + POLL_MS * 2);
        expect(screen.getByText("That block is no longer in this note.")).toBeTruthy();
        expect(peekNoteTarget()).toBeNull();
    });

    it("does nothing for a link to ANOTHER note", async () => {
        const fake = makeEditor();
        const el = addBlock(fake, BLOCK);
        render(<Probe editor={fake.editor} />);
        act(() => setNoteTarget({ noteType: 1, noteId: 99, blockId: BLOCK }));
        await tick(WAIT_MS * 2);
        expect(el.scrollIntoView).not.toHaveBeenCalled();
        expect(peekNoteTarget()).not.toBeNull(); // still waiting for note 99's own editor
    });

    it("does nothing for a note of another kind with the same id", async () => {
        const fake = makeEditor();
        const el = addBlock(fake, BLOCK);
        render(<Probe editor={fake.editor} />);
        act(() => setNoteTarget({ noteType: 2, noteId: 12, blockId: BLOCK }));
        await tick(POLL_MS * 4);
        expect(el.scrollIntoView).not.toHaveBeenCalled();
    });

    it("restarts the highlight when the same block is linked twice in a row", async () => {
        const fake = makeEditor();
        const el = addBlock(fake, BLOCK);
        render(<Probe editor={fake.editor} />);
        act(() => setNoteTarget({ ...NOTE, blockId: BLOCK }));
        await tick(0);
        await tick(HIGHLIGHT_MS - 500);
        act(() => setNoteTarget({ ...NOTE, blockId: BLOCK }));
        await tick(0);
        expect(el.scrollIntoView).toHaveBeenCalledTimes(2);
        // Past the FIRST reveal's end (4000) but inside the second's (3500 + 4000): the first
        // reveal's timer must not cut the second highlight short.
        await tick(HIGHLIGHT_MS - 1);
        expect(el.classList.contains(HIGHLIGHT_CLASS)).toBe(true);
        await tick(1);
        expect(el.classList.contains(HIGHLIGHT_CLASS)).toBe(false);
    });
});

describe("a comment link", () => {
    const threads = (map: Record<string, { deletedAt?: unknown }>) => () =>
        new Map(Object.entries(map));

    it("opens that thread's card once the thread exists", async () => {
        const fake = makeEditor();
        let current: Record<string, { deletedAt?: unknown }> = {};
        render(<Probe editor={fake.editor} getThreads={() => threads(current)()} />);
        act(() => setNoteTarget({ ...NOTE, threadId: THREAD }));
        await tick(POLL_MS * 4);
        expect(fake.selected).toEqual([]); // the threads have not loaded

        current = { [THREAD]: {} };
        await tick(POLL_MS);
        expect(fake.selected).toEqual([THREAD]);
        expect(peekNoteTarget()).toBeNull();
    });

    it("does not open a deleted thread, and says so", async () => {
        const fake = makeEditor();
        render(
            <Probe
                editor={fake.editor}
                getThreads={threads({ [THREAD]: { deletedAt: new Date() } })}
            />
        );
        act(() => setNoteTarget({ ...NOTE, threadId: THREAD }));
        await tick(WAIT_MS + POLL_MS * 2);
        expect(fake.selected).toEqual([]);
        expect(screen.getByText("That comment is no longer in this note.")).toBeTruthy();
    });

    it("waits when this note has no comment store at all", async () => {
        const fake = makeEditor();
        render(<Probe editor={fake.editor} getThreads={null} />);
        act(() => setNoteTarget({ ...NOTE, threadId: THREAD }));
        await tick(WAIT_MS + POLL_MS * 2);
        expect(fake.selected).toEqual([]);
        expect(screen.getByText("That comment is no longer in this note.")).toBeTruthy();
    });
});

describe("capturing the link when it arrives", () => {
    const Capture = ({ active = true }: { active?: boolean }) => {
        useCaptureNoteTarget(active);
        return null;
    };
    const at = (url: string, active = true) =>
        render(
            <MemoryRouter initialEntries={[url]}>
                <Capture active={active} />
            </MemoryRouter>
        );

    it("captures a block link on a page load", () => {
        at(`/workspace/notes/my/12?block=${BLOCK}`);
        expect(peekNoteTarget()).toMatchObject({ noteType: 1, noteId: 12, blockId: BLOCK });
    });

    it("captures a comment link on a task note", () => {
        at(`/workspace/notes/task/project/3/task/4/note/12?comment=${THREAD}`);
        expect(peekNoteTarget()).toMatchObject({ noteType: 2, noteId: 12, threadId: THREAD });
    });

    it("captures nothing from a plain note URL", () => {
        at("/workspace/notes/my/12");
        expect(peekNoteTarget()).toBeNull();
    });

    it("captures nothing while the notes page is the hidden, kept-alive one", () => {
        at(`/workspace/notes/my/12?block=${BLOCK}`, false);
        expect(peekNoteTarget()).toBeNull();
    });
});
