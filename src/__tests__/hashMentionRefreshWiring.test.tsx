/**
 * The `#` menu asks for fresh data when it is queried.
 *
 * Note metadata and the project list are fetched once per page load, so
 * without this the menu could only ever offer what existed when the tab
 * was opened — a teammate's note stayed missing until a reload. The
 * controller fires the (throttled) refresh from `getItems`.
 *
 * Deliberately NOT awaited there, so this also pins that the call still
 * returns items synchronously off the data it already has.
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HashMentionData, HashMentionDataProvider } from "../context/HashMentionDataContext";

// Capture the props BlockNote's controller would receive; rendering the
// real one needs a live editor instance, which this test doesn't need.
const captured: {
    getItems?: (query: string) => Promise<unknown[]>;
    minQueryLength?: number;
} = {};
vi.mock("@blocknote/react", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    SuggestionMenuController: (props: {
        getItems: (q: string) => Promise<unknown[]>;
        minQueryLength?: number;
    }) => {
        captured.getItems = props.getItems;
        captured.minQueryLength = props.minQueryLength;
        return null;
    },
}));

const { HashSuggestionMenuController } = await import("../components/editors/HashMention");

const editorStub = { insertInlineContent: vi.fn() };

const dataWith = (refresh: () => void): HashMentionData => ({
    tasks: [
        {
            id: "7",
            projectId: 1,
            displayId: "GEN-7",
            title: "Fix login",
        } as unknown as HashMentionData["tasks"][number],
    ],
    teamTasks: [],
    notes: [],
    chats: [],
    allChats: [],
    projects: [],
    todoGroups: [],
    myself: null,
    refresh,
});

describe("HashSuggestionMenuController", () => {
    it("asks for fresh data when the menu is queried, and still returns items", async () => {
        const refresh = vi.fn();
        render(
            <HashMentionDataProvider value={dataWith(refresh)}>
                <HashSuggestionMenuController editor={editorStub} />
            </HashMentionDataProvider>
        );

        expect(captured.getItems).toBeDefined();
        const items = await captured.getItems!("GEN");

        expect(refresh).toHaveBeenCalled();
        // The refresh is fire-and-forget: this call answers off the data
        // already in hand rather than waiting on the network.
        expect(items).toHaveLength(1);
    });

    it("waits for two query characters before showing anything", () => {
        // "#a" matches most of a workspace — the menu is noise until the
        // second character. Also keeps the Markdown "# " heading shortcut
        // working, which a threshold of 0 would break.
        render(
            <HashMentionDataProvider value={dataWith(vi.fn())}>
                <HashSuggestionMenuController editor={editorStub} />
            </HashMentionDataProvider>
        );

        expect(captured.minQueryLength).toBe(2);
    });

    it("fires the refresh on every query, leaving the throttling to the refresh itself", async () => {
        const refresh = vi.fn();
        render(
            <HashMentionDataProvider value={dataWith(refresh)}>
                <HashSuggestionMenuController editor={editorStub} />
            </HashMentionDataProvider>
        );

        await captured.getItems!("G");
        await captured.getItems!("GE");
        await captured.getItems!("GEN");

        // Naive on purpose — `createThrottledRefresh` collapses the burst.
        expect(refresh).toHaveBeenCalledTimes(3);
    });
});

// MIP-1038: BlockNote re-runs `getItems` whenever its IDENTITY changes
// (`useEffect(..., [query, getItems])`). A new function on every render made
// every unrelated data update re-run the menu's loader, and the loader asks the
// server for a typed id the lists don't hold, so a `#kds-652` left in the
// editor sent a request per render, forever (each reload of the data renders
// again, and `refresh()` inside the loader feeds the next one).
describe("HashSuggestionMenuController: a stable loader", () => {
    it("hands BlockNote the same getItems across re-renders and data changes", () => {
        const first = dataWith(vi.fn());
        const view = render(
            <HashMentionDataProvider value={first}>
                <HashSuggestionMenuController editor={editorStub} />
            </HashMentionDataProvider>
        );
        const loader = captured.getItems;

        // Same editor, new data object (what every list refresh produces).
        view.rerender(
            <HashMentionDataProvider value={{ ...first, projects: [] }}>
                <HashSuggestionMenuController editor={editorStub} />
            </HashMentionDataProvider>
        );

        expect(captured.getItems).toBe(loader);
    });

    it("still answers off the LATEST data, not the data of the render it was made in", async () => {
        const first = dataWith(vi.fn());
        const view = render(
            <HashMentionDataProvider value={first}>
                <HashSuggestionMenuController editor={editorStub} />
            </HashMentionDataProvider>
        );
        const loader = captured.getItems!;
        expect(await loader("login")).toHaveLength(1);

        view.rerender(
            <HashMentionDataProvider value={{ ...first, tasks: [] }}>
                <HashSuggestionMenuController editor={editorStub} />
            </HashMentionDataProvider>
        );

        // The very same function now sees the new (empty) task list.
        expect(await loader("login")).toHaveLength(0);
    });

    it("asks for a fresh loader when the editor itself changes", () => {
        const view = render(
            <HashMentionDataProvider value={dataWith(vi.fn())}>
                <HashSuggestionMenuController editor={editorStub} />
            </HashMentionDataProvider>
        );
        const loader = captured.getItems;

        view.rerender(
            <HashMentionDataProvider value={dataWith(vi.fn())}>
                <HashSuggestionMenuController editor={{ insertInlineContent: vi.fn() }} />
            </HashMentionDataProvider>
        );

        expect(captured.getItems).not.toBe(loader);
    });
});
