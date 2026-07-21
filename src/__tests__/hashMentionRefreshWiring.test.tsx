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
