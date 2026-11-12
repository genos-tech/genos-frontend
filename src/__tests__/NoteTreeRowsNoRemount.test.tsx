/**
 * Note sidebar rows must survive a tree rebuild.
 *
 * `useNoteTreeState` mints a new `timestamp` whenever the tree identity or the
 * selected tab changes, and the rows used to put it in their React `key`
 * (`note-box-${noteId}-${timestamp}`). A key change UNMOUNTS and rebuilds the
 * subtree, so every refresh tick and every note switch tore the whole sidebar
 * down and rebuilt it — measured at ~9,000 remounts in two idle minutes.
 *
 * The timestamp stays a prop (the `memo` needs to see a change), but it must
 * not reach a key. This guards both directions:
 *
 *   - an equal-content rebuild keeps the same DOM nodes and mounts nothing;
 *   - a REAL change (rename, add, move, selection) still shows up, i.e. taking
 *     the remount away did not leave a row stale.
 *
 * The "⋯" menu is replaced by a probe that counts its own mounts; it lives
 * inside the row's keyed subtree, so a remount of the row remounts it.
 */

import { useEffect } from "react";
import { List } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChildNoteCreator } from "../features/notes/chat-notes/components/ChildNoteCreator";
import { NoteTreeRenderer } from "../features/notes/common/components/NoteTreeRenderer";
import { useNoteTreeState } from "../features/notes/common/hooks/useNoteTreeState";
import type { MyNoteMetaTreeNode } from "../features/notes/common/types/noteTypes";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";

const probe = vi.hoisted(() => ({
    mounts: {} as Record<string, number>,
    unmounts: {} as Record<string, number>,
}));

vi.mock("../components/ui/MoreMenu", () => ({
    MoreMenu: ({ items }: { items: { id: string }[] }) => {
        const id = items[0]?.id ?? "none";
        useEffect(() => {
            probe.mounts[id] = (probe.mounts[id] ?? 0) + 1;
            return () => {
                probe.unmounts[id] = (probe.unmounts[id] ?? 0) + 1;
            };
        }, [id]);
        return <span data-testid={`menu-${id}`} />;
    },
}));

// A fresh, distinct stamp on every call, so the timestamp is guaranteed to
// differ between a render and its rebuild (the real one has 1 s resolution).
const clock = vi.hoisted(() => ({ n: 0 }));
vi.mock("../utils/dateUtils", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../utils/dateUtils")>()),
    getLocalCurrentTimestamp: () => `stamp-${++clock.n}`,
}));

type Node = MyNoteMetaTreeNode;

// Held constant: the real chain is state in `useNoteManagement`. A fresh `[]`
// per render would re-fire `useNoteTreeState`'s chain effect forever.
const CHAIN: Node[] = [];

const node = (noteId: number, title: string, children: Node[] = []): Node => ({
    noteType: 1,
    noteId,
    title,
    children,
});

// The tree the sidebar would be handed for these notes. Always built fresh,
// the way `buildMyNoteTree` does after a refresh that returned equal rows.
const baseTree = (): Node[] => [
    node(1, "Alpha", [node(11, "Alpha child one"), node(12, "Alpha child two")]),
    node(2, "Beta", [node(21, "Beta child")]),
];

const makeUseNM = (selectedNoteId: number | null = null) =>
    ({
        currentNoteType: 1,
        currentMyNote: selectedNoteId === null ? null : { noteId: selectedNoteId },
        currentTaskNote: null,
        currentChatNote: null,
        // The rows ask the ACTIVE TAB which note is open (MIP-1429), not `currentNoteType`.
        tabsApi: {
            activeTab:
                selectedNoteId === null
                    ? null
                    : { kind: "my", noteType: 1, noteId: selectedNoteId, bucket: "my" },
        },
        setCurrentNoteType: vi.fn(),
        loadNote: vi.fn(),
        // Every parent open, so the children are in the DOM.
        isNodeExpanded: () => true,
        toggleNodeExpanded: vi.fn(),
        isNoteFavorited: () => false,
        toggleFavorite: vi.fn(),
    }) as unknown as NoteManagementState;

const rowMenuItems = (n: Node) => [
    { id: `menu-${n.noteId}`, label: "Move", icon: null, onClick: () => {} },
];

// Wires the real `useNoteTreeState` to the real `NoteTreeRenderer` the same
// way `NoteSidebar.renderMyNoteTree` does.
const Sidebar = ({
    tree,
    selectedTabIndex,
    useNM,
}: {
    tree: Node[];
    selectedTabIndex: number;
    useNM: NoteManagementState;
}) => {
    const state = useNoteTreeState<Node>({
        metaTree: tree,
        currentChain: CHAIN,
        selectedTabIndex,
        currentNote: null,
    });
    return (
        <div data-stamp={state.timestamp} data-testid="stamp">
            <List>
                {state.tmpMetaTree.map((root) => (
                    <NoteTreeRenderer
                        key={root.noteId}
                        createChildNoteList={() => null}
                        currentChain={state.tmpCurrentChain}
                        node={root}
                        noteType={1}
                        rowMenuItems={rowMenuItems}
                        timestamp={state.timestamp}
                        useNM={useNM}
                    />
                ))}
            </List>
        </div>
    );
};

const tree = (props: { tree: Node[]; selectedTabIndex?: number; useNM: NoteManagementState }) => (
    <CssVarsProvider>
        <Sidebar
            selectedTabIndex={props.selectedTabIndex ?? 0}
            tree={props.tree}
            useNM={props.useNM}
        />
    </CssVarsProvider>
);

const stamp = () => screen.getByTestId("stamp").getAttribute("data-stamp");
const rowElements = (container: HTMLElement) => Array.from(container.querySelectorAll("li"));
const rowButtons = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>("[role='button'], button, a")).filter(
        (el) => el.classList.contains("MuiListItemButton-root")
    );
const buttonFor = (container: HTMLElement, title: string) =>
    rowButtons(container).find((b) => b.textContent?.includes(title));

beforeEach(() => {
    clock.n = 0;
    for (const k of Object.keys(probe.mounts)) delete probe.mounts[k];
    for (const k of Object.keys(probe.unmounts)) delete probe.unmounts[k];
});

describe("note rows survive an equal-content rebuild", () => {
    it("keeps every row's DOM node and mounts nothing when the tree is rebuilt", () => {
        const useNM = makeUseNM();
        const { container, rerender } = render(tree({ tree: baseTree(), useNM }));

        const rowsBefore = rowElements(container);
        expect(rowsBefore).toHaveLength(5); // 2 roots + 3 children, all expanded
        const stampBefore = stamp();
        const mountsBefore = { ...probe.mounts };
        expect(Object.keys(mountsBefore)).toHaveLength(5);

        // Same content, new array/objects: what an unchanged refresh produces
        // once it gets past the identity guards.
        rerender(tree({ tree: baseTree(), useNM }));

        // The premise: the tree really was rebuilt and the stamp really moved,
        // i.e. the old `key` WOULD have changed.
        expect(stamp()).not.toBe(stampBefore);

        const rowsAfter = rowElements(container);
        expect(rowsAfter).toHaveLength(rowsBefore.length);
        rowsAfter.forEach((el, i) => expect(el).toBe(rowsBefore[i]));
        expect(probe.mounts).toEqual(mountsBefore);
        expect(probe.unmounts).toEqual({});
    });

    it("keeps the rows when only the selected tab changes", () => {
        const useNM = makeUseNM();
        const base = baseTree();
        const { container, rerender } = render(tree({ tree: base, useNM, selectedTabIndex: 0 }));
        const rowsBefore = rowElements(container);
        const stampBefore = stamp();

        rerender(tree({ tree: base, useNM, selectedTabIndex: 3 }));

        expect(stamp()).not.toBe(stampBefore);
        rowElements(container).forEach((el, i) => expect(el).toBe(rowsBefore[i]));
        expect(probe.unmounts).toEqual({});
    });

    it("keeps the rows across the one-shot 1 s timestamp refresh", () => {
        vi.useFakeTimers();
        try {
            const useNM = makeUseNM();
            const { container } = render(tree({ tree: baseTree(), useNM }));
            const rowsBefore = rowElements(container);
            const stampBefore = stamp();

            act(() => {
                vi.advanceTimersByTime(1100);
            });

            expect(stamp()).not.toBe(stampBefore);
            rowElements(container).forEach((el, i) => expect(el).toBe(rowsBefore[i]));
            expect(probe.unmounts).toEqual({});
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("note rows still update when the tree really changes", () => {
    it("shows a renamed title without remounting the row", () => {
        const useNM = makeUseNM();
        const { container, rerender } = render(tree({ tree: baseTree(), useNM }));
        const rowsBefore = rowElements(container);
        expect(screen.getByText("Alpha child two")).toBeTruthy();

        const renamed = baseTree();
        renamed[0].children[1] = node(12, "Alpha child two (renamed)");
        rerender(tree({ tree: renamed, useNM }));

        expect(screen.queryByText("Alpha child two")).toBeNull();
        expect(screen.getByText("Alpha child two (renamed)")).toBeTruthy();
        rowElements(container).forEach((el, i) => expect(el).toBe(rowsBefore[i]));
        expect(probe.unmounts).toEqual({});
    });

    it("shows an added note and leaves the existing rows mounted", () => {
        const useNM = makeUseNM();
        const { container, rerender } = render(tree({ tree: baseTree(), useNM }));
        const rowsBefore = rowElements(container);

        const grown = baseTree();
        grown[0].children.push(node(13, "Alpha child three"));
        grown.push(node(3, "Gamma"));
        rerender(tree({ tree: grown, useNM }));

        expect(screen.getByText("Alpha child three")).toBeTruthy();
        expect(screen.getByText("Gamma")).toBeTruthy();
        const rowsAfter = rowElements(container);
        expect(rowsAfter).toHaveLength(rowsBefore.length + 2);
        // Every pre-existing row is still the same element.
        for (const el of rowsBefore) expect(rowsAfter).toContain(el);
        expect(probe.unmounts).toEqual({});
        expect(probe.mounts["menu-13"]).toBe(1);
        expect(probe.mounts["menu-3"]).toBe(1);
    });

    it("shows a removed note", () => {
        const useNM = makeUseNM();
        const { container, rerender } = render(tree({ tree: baseTree(), useNM }));

        const shrunk = baseTree();
        shrunk[0].children = shrunk[0].children.slice(0, 1);
        rerender(tree({ tree: shrunk, useNM }));

        expect(screen.queryByText("Alpha child two")).toBeNull();
        expect(rowElements(container)).toHaveLength(4);
        expect(probe.unmounts["menu-12"]).toBe(1);
    });

    it("moves a note under its new parent", () => {
        const useNM = makeUseNM();
        const { container, rerender } = render(tree({ tree: baseTree(), useNM }));
        const alphaRow = container.querySelectorAll("li")[0];
        const betaRow = rowElements(container).find((li) => li.textContent?.startsWith("Beta"));

        // 12 leaves Alpha and becomes a child of Beta.
        const moved = baseTree();
        const [mover] = moved[0].children.splice(1, 1);
        moved[1].children.push(mover);
        rerender(tree({ tree: moved, useNM }));

        const alphaAfter = rowElements(container).find((li) =>
            li.textContent?.startsWith("Alpha")
        );
        const betaAfter = rowElements(container).find((li) => li.textContent?.startsWith("Beta"));
        // The two parents were not remounted...
        expect(alphaAfter).toBe(alphaRow);
        expect(betaAfter).toBe(betaRow);
        // ...and the moved note now lives under Beta only.
        expect(betaAfter?.textContent).toContain("Alpha child two");
        expect(alphaAfter?.textContent).not.toContain("Alpha child two");
        expect(alphaAfter?.textContent).toContain("Alpha child one");
    });

    it("moves the selection highlight when only the selected tab changes", () => {
        // `useNM` is the same object across the two renders (mutated in place),
        // so the ONLY thing that can reach the memoized rows is the bumped
        // timestamp prop. This is the memo-invalidation path that has to keep
        // working now the key no longer changes.
        const useNM = makeUseNM(1);
        const base = baseTree();
        const { container, rerender } = render(tree({ tree: base, useNM, selectedTabIndex: 0 }));
        expect(buttonFor(container, "Alpha")?.classList.contains("Mui-selected")).toBe(true);
        expect(buttonFor(container, "Beta")?.classList.contains("Mui-selected")).toBe(false);
        const betaButton = buttonFor(container, "Beta");

        // Switching tabs changes the active tab (what the rows read), in place.
        (useNM as unknown as { tabsApi: { activeTab: unknown } }).tabsApi.activeTab = {
            kind: "my",
            noteType: 1,
            noteId: 2,
            bucket: "my",
        };
        rerender(tree({ tree: base, useNM, selectedTabIndex: 1 }));

        expect(buttonFor(container, "Alpha")?.classList.contains("Mui-selected")).toBe(false);
        expect(buttonFor(container, "Beta")?.classList.contains("Mui-selected")).toBe(true);
        // Same element, class flipped in place.
        expect(buttonFor(container, "Beta")).toBe(betaButton);
    });
});

describe("ChildNoteCreator", () => {
    it("is not remounted when its timestamp prop moves", () => {
        const useNM = makeUseNM();
        const n = node(1, "Alpha");
        const view = (timestamp: string) => (
            <CssVarsProvider>
                <List>
                    <ChildNoteCreator node={n} timestamp={timestamp} useNM={useNM} />
                </List>
            </CssVarsProvider>
        );
        const { container, rerender } = render(view("a"));
        const before = container.querySelector("li");
        expect(before).not.toBeNull();

        rerender(view("b"));

        expect(container.querySelector("li")).toBe(before);
    });
});
