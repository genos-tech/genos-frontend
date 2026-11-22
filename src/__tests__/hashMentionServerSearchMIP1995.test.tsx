/**
 * MIP-1995: the editors' `#` menu has no full task list. Tasks of other projects come from
 * `GET /search/tasks/` per query: debounced, cancelled by the next keystroke, and the
 * open project's own rows stay instant.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { serverTaskItems } from "../components/editors/HashMention";
import {
    HASH_SEARCH_DEBOUNCE_MS,
    HASH_SEARCH_LIMIT,
    searchHashTasks,
} from "../components/editors/hashTaskSearch";
import { SearchTeamTasksResponse, TaskTableProps } from "../types/tasks";

const searchTasksMock = vi.hoisted(() => vi.fn());
vi.mock("../features/tasks/services/searchTasks", () => ({ searchTasks: searchTasksMock }));

const me = { teamId: 5 } as never;
const row = (over: Partial<SearchTeamTasksResponse>) =>
    ({
        projectId: 2,
        projectName: "Marketing",
        taskId: 9,
        displayId: "MKT-9",
        title: "Launch post",
        ...over,
    }) as unknown as SearchTeamTasksResponse;

describe("searchHashTasks", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        searchTasksMock.mockReset();
        searchTasksMock.mockResolvedValue({ results: [row({})], hasMore: false });
    });
    afterEach(() => vi.useRealTimers());

    it("sends nothing until typing pauses, then one bounded request", async () => {
        const editor = {};
        const p = searchHashTasks(editor, me, "tok", "launch");
        expect(searchTasksMock).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(HASH_SEARCH_DEBOUNCE_MS);
        expect(await p).toHaveLength(1);
        expect(searchTasksMock).toHaveBeenCalledTimes(1);
        expect(searchTasksMock.mock.calls[0][2]).toEqual({
            q: "launch",
            limit: HASH_SEARCH_LIMIT,
        });
    });

    it("a newer keystroke cancels the previous query before it is sent", async () => {
        const editor = {};
        const first = searchHashTasks(editor, me, "tok", "la");
        await vi.advanceTimersByTimeAsync(HASH_SEARCH_DEBOUNCE_MS / 2);
        const second = searchHashTasks(editor, me, "tok", "lau");
        await vi.advanceTimersByTimeAsync(HASH_SEARCH_DEBOUNCE_MS);
        expect(await first).toEqual([]);
        expect(await second).toHaveLength(1);
        expect(searchTasksMock).toHaveBeenCalledTimes(1);
        expect(searchTasksMock.mock.calls[0][2].q).toBe("lau");
    });

    it("aborts an in-flight request when the next query starts", async () => {
        const editor = {};
        let signal: AbortSignal | undefined;
        searchTasksMock.mockImplementationOnce((_m, _t, _p, s) => {
            signal = s;
            return new Promise(() => {});
        });
        void searchHashTasks(editor, me, "tok", "la");
        await vi.advanceTimersByTimeAsync(HASH_SEARCH_DEBOUNCE_MS);
        expect(signal?.aborted).toBe(false);
        void searchHashTasks(editor, me, "tok", "lau");
        expect(signal?.aborted).toBe(true);
    });

    it("a failed request leaves no rows instead of throwing", async () => {
        searchTasksMock.mockRejectedValueOnce(new Error("boom"));
        const p = searchHashTasks({}, me, "tok", "launch");
        await vi.advanceTimersByTimeAsync(HASH_SEARCH_DEBOUNCE_MS);
        expect(await p).toEqual([]);
    });

    it("does nothing without a session or a query", async () => {
        expect(await searchHashTasks({}, null, "tok", "launch")).toEqual([]);
        expect(await searchHashTasks({}, me, "tok", "  ")).toEqual([]);
        expect(searchTasksMock).not.toHaveBeenCalled();
    });
});

describe("serverTaskItems", () => {
    it("drops rows the open project already offers", () => {
        const local = [
            { id: "9", projectId: 2, displayId: "MKT-9", title: "Launch post" },
        ] as unknown as TaskTableProps[];
        const items = serverTaskItems({}, [row({}), row({ taskId: 10, displayId: "MKT-10" })], {
            tasks: local,
            projects: [],
        });
        expect(items.map((i) => i.title)).toEqual(["MKT-10"]);
    });
});
