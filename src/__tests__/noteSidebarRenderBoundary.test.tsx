/**
 * The notes sidebar must not re-render for a render of `AppBody` that changed nothing it shows
 * (MIP-2379).
 *
 * A note switch is several renders of `AppBody`, and every manager (`useNM`, `useCM`, `useTEM`,
 * `useUISM`) is a NEW object on every one of them, with the functions the real hooks do not
 * memoize recreated each time. The sidebar took all of them whole, so its whole tree (every
 * section and every note row) re-rendered on every pass.
 *
 * This renders `NoteSidebar` through its public entry point, with full managers rebuilt on every
 * render, as `NoteHome` does, and counts renders at two places only the tree under test renders:
 *   - `NoteTypeSection`: once per section, per render of the sidebar body;
 *   - `NoteKindIcon`: once per note row, per render of that row.
 * Data is held at module level, so a render only changes what the test says it changes.
 */

import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteSidebar } from "../features/notes/common/components/NoteSidebar";
import { NoteUnreadProvider } from "../features/notes/common/context/NoteUnreadContext";
import type { UserProps } from "../types/admin";

const counts = { sections: 0, rows: 0 };
// Name and manager generation of each on-mount load call (MIP-2229).
const loads: Array<[string, number]> = [];

vi.mock("../features/notes/common/components/NoteTypeSection", async () => {
    const actual = await vi.importActual<
        typeof import("../features/notes/common/components/NoteTypeSection")
    >("../features/notes/common/components/NoteTypeSection");
    return {
        ...actual,
        NoteTypeSection: (props: Parameters<typeof actual.NoteTypeSection>[0]) => {
            counts.sections += 1;
            return actual.NoteTypeSection(props);
        },
    };
});
vi.mock("../features/notes/common/components/noteOrigin", async () => {
    const actual = await vi.importActual<
        typeof import("../features/notes/common/components/noteOrigin")
    >("../features/notes/common/components/noteOrigin");
    return {
        ...actual,
        NoteKindIcon: () => {
            counts.rows += 1;
            return null;
        },
    };
});
vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));
vi.mock("../features/notes/templates/teamNoteTemplates", async () => {
    const actual = await vi.importActual<
        typeof import("../features/notes/templates/teamNoteTemplates")
    >("../features/notes/templates/teamNoteTemplates");
    return { ...actual, loadTeamNoteTemplates: vi.fn(async () => []) };
});

// -------------------------------------------------------------------- data
// Module level on purpose: only what a test patches may change between renders.

const myself = { userId: "me", userName: "Me", teamId: "team1" } as unknown as UserProps;
const noop = () => {};
const unread = { isUnread: () => false, markRead: noop, unreadNotes: [] };
const EMPTY: never[] = [];
const FOREST = { rootFolders: EMPTY, rootNotes: EMPTY };

const noteNode = (noteId: number) => ({
    noteType: 1 as const,
    noteId,
    parentNoteId: null,
    title: `Note ${noteId}`,
    tsUpdated: "",
    children: EMPTY,
});
const NOTES = [noteNode(1), noteNode(2), noteNode(3)];
const MY_FOREST = { rootFolders: EMPTY, rootNotes: NOTES };
const TAB_A = { kind: "my", noteId: 1 } as const;
const TAB_B = { kind: "my", noteId: 2 } as const;
const CURRENT_A = { noteId: 1 };
const CURRENT_B = { noteId: 2 };
const TEAM = { isGuest: false };
const PROFILES = {};
const FAVORITES = { personalNotes: EMPTY, taskNotes: EMPTY, chatNotes: EMPTY, folders: EMPTY };
const RECENTS = { personalNotes: EMPTY, taskNotes: EMPTY, chatNotes: EMPTY };

// Stable functions: React `useState` setters and `useCallback`s in the real hook.
const stable = {
    setCurrentNoteType: vi.fn(),
    isNodeExpanded: () => false,
    toggleNodeExpanded: vi.fn(),
    isFolderExpanded: () => false,
    toggleFolderExpanded: vi.fn(),
    isNoteFavorited: () => false,
    isFolderFavorited: () => false,
};

type World = {
    activeTab: typeof TAB_A | typeof TAB_B;
    currentMyNote: { noteId: number };
    // Read by other parts of the page, never by the sidebar.
    openingNote: { n: number } | null;
    noteResync: Record<string, number>;
    teamId: string;
    // Which render's manager object a load was called on.
    generation: number;
};

const initialWorld = (): World => ({
    activeTab: TAB_A,
    currentMyNote: CURRENT_A,
    openingNote: null,
    noteResync: {},
    teamId: myself.teamId,
    generation: 0,
});

// Functions the real hook does not memoize: a new one for every render of the world.
const makeFn = () => () => Promise.resolve([]);

const loadFn = (name: string, generation: number) => () => {
    loads.push([name, generation]);
    return Promise.resolve([]);
};

let setWorld: (updater: (w: World) => World) => void = () => {};

// What `AppBody` does: every render builds every manager anew.
const Harness = () => {
    const [world, set] = useState<World>(initialWorld);
    setWorld = set;

    const useNM = {
        ...stable,
        ...world,
        // `tabsApi` is a new object on every render in the real hook; the tab inside it is not.
        tabsApi: { activeTab: world.activeTab, tabs: [] },
        currentNoteType: 1,
        currentTaskNote: undefined,
        currentChatNote: undefined,
        currentMyNoteChain: undefined,
        currentTaskNoteChain: undefined,
        currentChatNoteChain: undefined,
        taskNoteMeta: EMPTY,
        chatNoteMeta: EMPTY,
        myNoteMeta: EMPTY,
        teamNoteMeta: EMPTY,
        sharedNoteMeta: EMPTY,
        myNoteFolders: EMPTY,
        myNoteFolderForest: MY_FOREST,
        teamNoteFolders: EMPTY,
        teamNoteFolderForest: FOREST,
        myNoteMetaTree: NOTES,
        taskNoteMetaTree: EMPTY,
        chatNoteMetaTree: EMPTY,
        sharedNoteMetaTree: EMPTY,
        teamNoteMetaTree: EMPTY,
        favoriteNotes: FAVORITES,
        recentNotes: RECENTS,
        highlightedFolderId: null,
        getFavoriteNotesMeta: loadFn("favorites", world.generation),
        getRecentNotesMeta: loadFn("recent", world.generation),
        getSharedNoteMeta: loadFn("shared", world.generation),
        getTeamNoteFolders: loadFn("teamFolders", world.generation),
        getTeamNoteMeta: loadFn("teamNotes", world.generation),
        getMyNoteFolders: makeFn(),
        getMyNoteMeta: makeFn(),
        getTaskNoteMeta: makeFn(),
        getChatNoteMeta: makeFn(),
        handleCreateNewMyNote: makeFn(),
        handleCreateNewTaskNote: makeFn(),
        handleCreateNewChatNote: makeFn(),
        loadNote: makeFn(),
        toggleFavorite: makeFn(),
        toggleFolderFavorite: makeFn(),
        revealFolder: makeFn(),
        moveTaskNoteToTask: makeFn(),
        moveChatNoteToChat: makeFn(),
        moveMyNoteToFolder: makeFn(),
        createMyNoteFolder: makeFn(),
        renameMyNoteFolder: makeFn(),
        moveMyNoteFolder: makeFn(),
        deleteMyNoteFolder: makeFn(),
        deleteMyNoteById: makeFn(),
        deleteTaskNoteById: makeFn(),
        deleteChatNoteById: makeFn(),
        forceDeleteNoteById: makeFn(),
        createTeamNoteFolder: makeFn(),
        renameTeamNoteFolder: makeFn(),
        moveTeamNoteFolder: makeFn(),
        deleteTeamNoteFolder: makeFn(),
    };
    const useCM = { allChats: EMPTY, activityMessages: EMPTY };
    const useTEM = { currentTeam: TEAM, teamMemberProfiles: PROFILES };
    const useUISM = { isLoading: false };

    return (
        <NoteSidebar
            myself={world.teamId === myself.teamId ? myself : { ...myself, teamId: world.teamId }}
            setMyself={noop}
            socket={null}
            useCM={useCM as never}
            useNM={useNM as never}
            useTEM={useTEM as never}
            useUISM={useUISM as never}
        />
    );
};

const settled = async () => {
    await act(async () => {
        await Promise.resolve();
    });
};

const mount = async () => {
    // The providers sit above `AppBody` in the app, so they do not re-render with it.
    render(
        <CssVarsProvider>
            <NoteUnreadProvider value={unread}>
                <Harness />
            </NoteUnreadProvider>
        </CssVarsProvider>
    );
    await settled();
    // The first effects (chain ready, tree sync) are part of mounting.
    await settled();
    return { ...counts };
};

describe("NoteSidebar render boundary (MIP-2379)", () => {
    beforeEach(() => {
        counts.sections = 0;
        counts.rows = 0;
        loads.length = 0;
        // jsdom has no scrollIntoView; the selected row calls it from a 260 ms
        // timer that can fire after a test ends, which vitest reports as an
        // unhandled error and fails the shard.
        Element.prototype.scrollIntoView = vi.fn();
    });

    it("loads its lists once per team, on the manager of that render", async () => {
        const names = ["favorites", "recent", "shared", "teamFolders", "teamNotes"];
        await mount();
        expect(loads).toEqual(names.map((name) => [name, 0]));

        // A render of the sidebar with a new manager object is not a reason to load again.
        loads.length = 0;
        await act(async () =>
            setWorld((w) => ({
                ...w,
                generation: 1,
                activeTab: TAB_B,
                currentMyNote: CURRENT_B,
            }))
        );
        expect(loads).toEqual([]);

        // Another team is, and it is the current manager that is asked.
        await act(async () => setWorld((w) => ({ ...w, generation: 2, teamId: "team2" })));
        expect(loads).toEqual(names.map((name) => [name, 2]));
    });

    it("draws its sections and one row per note when it mounts", async () => {
        const first = await mount();
        expect(first.sections).toBeGreaterThan(0);
        expect(first.rows).toBeGreaterThanOrEqual(NOTES.length);
    });

    it("does not re-render for a render that changed nothing it reads", async () => {
        await mount();
        const before = { ...counts };
        for (let i = 0; i < 5; i += 1) {
            await act(async () => {
                // New managers every time; a member the sidebar never reads moves.
                setWorld((w) => ({ ...w, openingNote: { n: i }, noteResync: { [`1-${i}`]: i } }));
            });
        }
        expect(counts).toEqual(before);
    });

    it("re-renders the rows once, and the sections not at all, when the open tab changes", async () => {
        await mount();
        const before = { ...counts };
        await act(async () => {
            setWorld((w) => ({ ...w, activeTab: TAB_B }));
        });
        expect(counts.sections).toBe(before.sections);
        // Every row sees the new tab once (the memo holds for the rest of the renders).
        expect(counts.rows - before.rows).toBe(NOTES.length);
    });

    it("re-renders the body, and not the rows, when the open note changes", async () => {
        await mount();
        const before = { ...counts };
        await act(async () => {
            setWorld((w) => ({ ...w, currentMyNote: CURRENT_B }));
        });
        expect(counts.sections).toBeGreaterThan(before.sections);
        expect(counts.rows).toBe(before.rows);
    });
});
