/**
 * MIP-1990: the task bar's search. Focus loads a short starting list and never the whole task
 * list; typing sends ONE debounced query, cancels the one before it, and pages.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { highlightParts } from "../features/tasks/components/header/highlightParts";
import {
    PAGE_SIZE,
    SEARCH_DEBOUNCE_MS,
    START_LIST_SIZE,
    useTaskSearchBar,
} from "../features/tasks/hooks/useTaskSearchBar";
import { loadRecentTasks } from "../features/tasks/services/recentTasks";
import { searchTasks } from "../features/tasks/services/searchTasks";
import { SearchTeamTasksResponse } from "../types/tasks";

vi.mock("../features/tasks/services/recentTasks", () => ({ loadRecentTasks: vi.fn() }));
vi.mock("../features/tasks/services/searchTasks", () => ({ searchTasks: vi.fn() }));
vi.mock("../features/tasks/services/loadTaskSearchList", () => ({
    loadTeamTaskList: vi.fn(() => {
        throw new Error("the task bar must never load the whole list");
    }),
}));

const row = (taskId: number, title = `task ${taskId}`) =>
    ({
        taskId,
        title,
        displayId: `MIP-${taskId}`,
        projectId: 1,
        projectName: "P",
        status: { status: "Open" },
    }) as unknown as SearchTeamTasksResponse;

const me = { teamId: "team-1" };
const mockSearch = vi.mocked(searchTasks);
const mockRecent = vi.mocked(loadRecentTasks);

const mount = () =>
    renderHook(() => useTaskSearchBar({ myself: me, accessToken: "t", projectId: 7 }));

beforeEach(() => {
    mockSearch.mockReset();
    mockRecent.mockReset();
    mockRecent.mockResolvedValue([1, 2, 3, 4, 5, 6, 7].map((i) => row(i)));
    mockSearch.mockResolvedValue({ results: [row(2), row(20), row(21)], hasMore: false });
});
afterEach(() => vi.useRealTimers());

describe("the starting list", () => {
    it("loads nothing until the box is focused", () => {
        mount();
        expect(mockRecent).not.toHaveBeenCalled();
        expect(mockSearch).not.toHaveBeenCalled();
    });

    it("on focus: a handful of recents, then the project's open tasks, without repeats", async () => {
        const { result } = mount();
        act(() => result.current.setActive(true));
        await waitFor(() => expect(result.current.options.length).toBeGreaterThan(0));
        expect(mockSearch).toHaveBeenCalledTimes(1);
        expect(mockSearch.mock.calls[0][2]).toMatchObject({
            projectId: 7,
            statuses: "open,wip,blocked,pending",
        });
        const { options } = result.current;
        expect(options.filter((o) => o.section === "recent")).toHaveLength(START_LIST_SIZE);
        // task 2 is both a recent and an open task of the project: listed once.
        expect(options.map((o) => o.taskId)).toEqual([1, 2, 3, 4, 5, 20, 21]);
        expect(options.filter((o) => o.section === "project").map((o) => o.taskId)).toEqual([
            20, 21,
        ]);
    });

    it("keeps the recents when only the project half fails", async () => {
        mockSearch.mockRejectedValue(new Error("boom"));
        const { result } = mount();
        act(() => result.current.setActive(true));
        await waitFor(() => expect(result.current.options.length).toBe(START_LIST_SIZE));
        expect(result.current.error).toBe(false);
    });

    it("shows an error state when both halves fail", async () => {
        mockSearch.mockRejectedValue(new Error("boom"));
        mockRecent.mockResolvedValue(undefined);
        mockRecent.mockRejectedValue(new Error("boom"));
        const { result } = mount();
        act(() => result.current.setActive(true));
        await waitFor(() => expect(result.current.error).toBe(true));
    });
});

describe("typing", () => {
    it("sends one query after the pause, not one per key", async () => {
        const { result } = mount();
        act(() => result.current.setActive(true));
        await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
        mockSearch.mockClear();
        vi.useFakeTimers();
        act(() => result.current.setQuery("lo"));
        act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50));
        act(() => result.current.setQuery("log"));
        act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50));
        expect(mockSearch).not.toHaveBeenCalled();
        await act(async () => {
            vi.advanceTimersByTime(60);
        });
        expect(mockSearch).toHaveBeenCalledTimes(1);
        expect(mockSearch.mock.calls[0][2]).toEqual({ q: "log", limit: PAGE_SIZE });
    });

    it("aborts the request in flight when the text changes", async () => {
        const signals: AbortSignal[] = [];
        mockSearch.mockImplementation((_m, _a, _p, signal) => {
            if (signal) signals.push(signal);
            return new Promise(() => {});
        });
        const { result } = mount();
        act(() => result.current.setActive(true));
        vi.useFakeTimers();
        act(() => result.current.setQuery("a"));
        await act(async () => {
            vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 1);
        });
        const first = signals[signals.length - 1];
        act(() => result.current.setQuery("ab"));
        expect(first.aborted).toBe(true);
    });

    it("pages: the next page is appended with the offset, repeats dropped", async () => {
        const page1 = Array.from({ length: PAGE_SIZE }, (_, i) => row(100 + i));
        mockSearch.mockImplementation(async (_m, _a, p) => {
            if (p.q && !p.offset) return { results: page1, hasMore: true };
            if (p.q) return { results: [row(100), row(999)], hasMore: false };
            return { results: [], hasMore: false };
        });
        const { result } = mount();
        act(() => result.current.setActive(true));
        act(() => result.current.setQuery("task"));
        await waitFor(() => expect(result.current.options).toHaveLength(PAGE_SIZE), {
            timeout: 2000,
        });
        act(() => result.current.loadMore());
        await waitFor(() => expect(result.current.options).toHaveLength(PAGE_SIZE + 1));
        expect(mockSearch.mock.calls.at(-1)?.[2]).toMatchObject({ offset: PAGE_SIZE });
        expect(result.current.options.at(-1)?.taskId).toBe(999);
    });

    it("clearing the box goes back to the starting list", async () => {
        const { result } = mount();
        act(() => result.current.setActive(true));
        await waitFor(() => expect(result.current.options.length).toBe(7));
        act(() => result.current.setQuery("zzz"));
        await waitFor(() => expect(result.current.highlight).toBe("zzz"), { timeout: 2000 });
        act(() => result.current.setQuery(""));
        await waitFor(() => expect(result.current.options.length).toBe(7));
        expect(result.current.highlight).toBe("");
    });
});

describe("highlightParts", () => {
    it("marks every case-insensitive hit", () => {
        expect(highlightParts("Fix Login login", "LOGIN")).toEqual([
            { text: "Fix ", match: false },
            { text: "Login", match: true },
            { text: " ", match: false },
            { text: "login", match: true },
        ]);
    });
    it("leaves a blank query, a miss and a leading # alone", () => {
        expect(highlightParts("abc", "  ")).toEqual([{ text: "abc", match: false }]);
        expect(highlightParts("abc", "x")).toEqual([{ text: "abc", match: false }]);
        expect(highlightParts("MIP-7", "#mip")).toEqual([
            { text: "MIP", match: true },
            { text: "-7", match: false },
        ]);
    });
});
