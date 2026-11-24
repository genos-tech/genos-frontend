import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { initCurrentChatNoteChain, updataChatNoteChain } from "../../hooks/notes/chatNote";
import { initCurrentMyNoteChain, updataMyNoteChain } from "../../hooks/notes/myNote";
import { initCurrentTaskNoteChain, updataTaskNoteChain } from "../../hooks/notes/taskNote";

// MIP-2229: the chain effects must run only for their listed dependencies
// (note, tabs, selected tab, tree / meta) while reading the LATEST chain and
// setters. The three files are copies of one another, so one table drives all.

type Node = { noteId: number; noteType: number; children: Node[] };
const leaf = (noteId: number): Node => ({ noteId, noteType: 1, children: [] });
const tree: Node[] = [{ ...leaf(1), children: [leaf(2)] }];
const tabItems = [{ noteId: 2, noteType: 1, title: "t" }];

type Update = (props: never) => void;
type Init = (props: never) => void;

const CASES: {
    name: string;
    update: Update;
    init: Init;
    keys: { note: string; tree: string; chain: string; setChain: string; meta: string };
}[] = [
    {
        name: "chat",
        update: updataChatNoteChain as Update,
        init: initCurrentChatNoteChain as Init,
        keys: {
            note: "currentChatNote",
            tree: "chatNoteMetaTree",
            chain: "currentChatNoteChain",
            setChain: "setCurrentChatNoteChain",
            meta: "chatNoteMeta",
        },
    },
    {
        name: "my",
        update: updataMyNoteChain as Update,
        init: initCurrentMyNoteChain as Init,
        keys: {
            note: "currentMyNote",
            tree: "myNoteMetaTree",
            chain: "currentMyNoteChain",
            setChain: "setCurrentMyNoteChain",
            meta: "myNoteMeta",
        },
    },
    {
        name: "task",
        update: updataTaskNoteChain as Update,
        init: initCurrentTaskNoteChain as Init,
        keys: {
            note: "currentTaskNote",
            tree: "taskNoteMetaTree",
            chain: "currentTaskNoteChain",
            setChain: "setCurrentTaskNoteChain",
            meta: "taskNoteMeta",
        },
    },
];

describe.each(CASES)("$name note chain hooks (MIP-2229)", ({ update, init, keys }) => {
    const updateProps = (over: Record<string, unknown> = {}) => ({
        [keys.note]: null,
        [keys.tree]: tree,
        [keys.chain]: undefined,
        [keys.setChain]: vi.fn(),
        setAllNoteIdChains: vi.fn(),
        allNoteIdChains: {},
        tabItems,
        selectedTabIndex: 0,
        ...over,
    });
    const run = (p: Record<string, unknown>) => (update as (p: unknown) => void)(p);
    const runInit = (p: Record<string, unknown>) => (init as (p: unknown) => void)(p);

    it("sets the chain for the selected tab and records it", () => {
        const props = updateProps();
        renderHook(() => run(props));
        const set = props[keys.setChain] as ReturnType<typeof vi.fn>;
        expect(set).toHaveBeenCalledTimes(1);
        expect(set.mock.calls[0][0].map((n: Node) => n.noteId)).toEqual([1, 2]);
        const all = (props.setAllNoteIdChains as ReturnType<typeof vi.fn>).mock.calls[0][0]({});
        expect(all).toEqual({ "1-2": [1, 2] });
    });

    it("clears the chain when there is no selected tab", () => {
        const props = updateProps({ tabItems: [] });
        renderHook(() => run(props));
        expect(props[keys.setChain]).toHaveBeenCalledWith([]);
    });

    it("does not re-run when only the chain or the setters change", () => {
        const first = updateProps();
        const { rerender } = renderHook((p) => run(p), { initialProps: first });
        const chain = (first[keys.setChain] as ReturnType<typeof vi.fn>).mock.calls[0][0];
        const second = updateProps({ [keys.chain]: chain });
        rerender(second);
        expect(second[keys.setChain]).not.toHaveBeenCalled();
        expect(second.setAllNoteIdChains).not.toHaveBeenCalled();
        expect(first[keys.setChain]).toHaveBeenCalledTimes(1);
    });

    it("re-runs on a listed dependency and uses the latest chain and setters", () => {
        const first = updateProps();
        const { rerender } = renderHook((p) => run(p), { initialProps: first });
        const sameChain = (first[keys.setChain] as ReturnType<typeof vi.fn>).mock.calls[0][0];
        // Same chain content, new tabItems identity: effect runs, chain equal => no set.
        const second = updateProps({ [keys.chain]: sameChain, tabItems: [...tabItems] });
        rerender(second);
        expect(second[keys.setChain]).not.toHaveBeenCalled();
        expect((second.setAllNoteIdChains as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
        // A different chain in the latest props => the latest setter is called.
        const third = updateProps({ [keys.chain]: [leaf(9)], tabItems: [...tabItems] });
        rerender(third);
        expect(third[keys.setChain]).toHaveBeenCalledTimes(1);
        expect(first[keys.setChain]).toHaveBeenCalledTimes(1);
    });

    it("init: clears an undefined chain only when meta changes to empty", () => {
        const setChain = vi.fn();
        const base = { [keys.meta]: [{}], [keys.chain]: undefined, [keys.setChain]: setChain };
        const { rerender } = renderHook((p) => runInit(p), { initialProps: base });
        expect(setChain).not.toHaveBeenCalled();
        const newSetter = vi.fn();
        const empty: never[] = [];
        rerender({ [keys.meta]: empty, [keys.chain]: undefined, [keys.setChain]: newSetter });
        expect(setChain).not.toHaveBeenCalled();
        expect(newSetter).toHaveBeenCalledWith([]);
        // Setter / chain change alone does not re-run.
        const another = vi.fn();
        rerender({
            [keys.meta]: empty,
            [keys.chain]: undefined,
            [keys.setChain]: another,
        });
        expect(another).not.toHaveBeenCalled();
    });
});
