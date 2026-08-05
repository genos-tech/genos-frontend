/**
 * A checkpoint must never outlive the rows it vouches for.
 *
 * `syncWithCheckpoint` stores a watermark meaning "I hold everything up to
 * here", and every later sync asks the server only for changes since. When
 * the rows behind that watermark are missing, nothing ever asks for them
 * again — a changes-since answer cannot mention a row that has not changed
 * — so the task table, board and dashboard for a project stay empty for the
 * rest of the install's life, while the single-task preview beside them
 * works fine because it reads a different store.
 *
 * Three ways in, all of which shipped:
 *   - a full load that legitimately returned nothing, because the server
 *     was refusing the caller — a guest opening a project another team
 *     shared, before the API was taught to answer for them;
 *   - `loadTeamTasks`, which clears the whole shared `taskMeta` store and
 *     used to leave every per-project watermark standing;
 *   - a share that arrives after the watermark, where the guest's own new
 *     task lands and the project's existing work never does. The store is
 *     not empty in that one, which is why the server sends the count it
 *     expects us to hold and we compare.
 *
 * Real in-memory IndexedDB (fake-indexeddb) so the checkpoint store, the
 * task store and its projectId index all behave as they do in the browser.
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../../db/config";
import { TaskRepository } from "../../db/repositories";
import { CheckpointRepository } from "../../db/repositories/checkpoints";
import { tasksHandlers } from "../../db/workers/handlers/tasks.handlers";
import { loadProjectTasksFromApi } from "../../features/tasks/services/loadProjectTasksFromApi";
import { loadTeamTasks } from "../../features/tasks/services/loadTeamTasks";
import type { UserProps } from "../../types/admin";
import type { TaskTableProps } from "../../types/tasks";

vi.mock("../../features/tasks/services/loadProjectTasksFromApi", () => ({
    loadProjectTasksFromApi: vi.fn(),
}));
vi.mock("../../features/tasks/services/loadTeamTasks", () => ({
    loadTeamTasks: vi.fn(),
}));

// initDB never closes the connections it opens; deleteDB then logs a
// `blocking` warning as it forces them shut. Expected teardown noise.
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
afterAll(() => warnSpy.mockRestore());

const PROJECT_ID = 7;
const KEY = `tasks:${PROJECT_ID}`;

// The guest's own team. The shared project's tasks are filed under the
// HOST team, which is exactly what used to get them filtered away.
const guest = { userId: "u-guest", teamId: "team-b" } as UserProps;

const hostTask = (id: number): TaskTableProps =>
    ({
        id,
        title: `host task ${id}`,
        projectId: PROJECT_ID,
        teamId: "team-a",
        status: "Open",
        tags: [],
    }) as unknown as TaskTableProps;

/** A full answer: the whole list, so it is its own count. */
const full = (tasks: TaskTableProps[], serverTime: string) => ({
    serverTime,
    tasks,
    forceFull: false,
});

/** An answer to "what changed", which says how many rows we should hold. */
const changes = (tasks: TaskTableProps[], serverTime: string, totalCount: number) => ({
    serverTime,
    tasks,
    forceFull: false,
    totalCount,
});

const load = () =>
    tasksHandlers.loadProjectTasks({
        myself: guest,
        projectId: PROJECT_ID,
        accessToken: "token",
    } as never);

const sinceOfCall = (call: number): string | null =>
    vi.mocked(loadProjectTasksFromApi).mock.calls[call][3];

const storedIds = async () =>
    (await new TaskRepository().getTasksByProject(PROJECT_ID)).map((r) => r.id).sort();

describe("a project whose rows never arrived heals itself", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await deleteDB(DB_NAME);
    });

    it("re-asks for everything when the watermark has nothing behind it", async () => {
        // First load: the server answers the guest with nothing at all.
        vi.mocked(loadProjectTasksFromApi).mockResolvedValueOnce(full([], "T1"));
        await load();
        expect(await new CheckpointRepository().getCheckpoint(KEY)).toBe("T1");

        // Second load, after the API learned to answer guests. Asked for
        // changes since T1 it still lists nothing — the tasks are older than
        // the watermark — but it says there should be two. The retry drops
        // `since`.
        vi.mocked(loadProjectTasksFromApi)
            .mockResolvedValueOnce(changes([], "T2", 2))
            .mockResolvedValueOnce(full([hostTask(1), hostTask(2)], "T3"));
        await load();

        expect(vi.mocked(loadProjectTasksFromApi)).toHaveBeenCalledTimes(3);
        expect(sinceOfCall(1)).toBe("T1");
        expect(sinceOfCall(2)).toBeNull();
        expect(await storedIds()).toEqual([1, 2]);
        expect(await new CheckpointRepository().getCheckpoint(KEY)).toBe("T3");
    });

    it("re-asks when a share arrives after the watermark", async () => {
        // The gap that survived the empty-store fix: this guest has one
        // task of their own in the project — the one they created after
        // being invited — so the store is not empty. Everything the project
        // already contained is older than the watermark and unmentionable.
        vi.mocked(loadProjectTasksFromApi).mockResolvedValueOnce(full([hostTask(9)], "T1"));
        await load();

        vi.mocked(loadProjectTasksFromApi)
            .mockResolvedValueOnce(changes([], "T2", 3))
            .mockResolvedValueOnce(full([hostTask(1), hostTask(2), hostTask(9)], "T3"));
        await load();

        expect(sinceOfCall(2)).toBeNull();
        expect(await storedIds()).toEqual([1, 2, 9]);
    });

    it("asks once when the rows are all there", async () => {
        vi.mocked(loadProjectTasksFromApi).mockResolvedValueOnce(full([hostTask(1)], "T1"));
        await load();
        vi.mocked(loadProjectTasksFromApi).mockResolvedValueOnce(changes([], "T2", 1));
        await load();

        // The second sync returned no changes, which is the normal answer
        // for a quiet project and must not trigger a re-fetch.
        expect(vi.mocked(loadProjectTasksFromApi)).toHaveBeenCalledTimes(2);
        expect(sinceOfCall(1)).toBe("T1");
    });

    it("forgets every project's watermark when the team load empties the store", async () => {
        vi.mocked(loadProjectTasksFromApi).mockResolvedValueOnce(full([hostTask(1)], "T1"));
        await load();

        // `loadTeamTasks` clears `taskMeta` wholesale. Anything it doesn't
        // return is gone — including, until the API fix, every task in a
        // project shared from another team.
        vi.mocked(loadTeamTasks).mockResolvedValueOnce([]);
        await tasksHandlers.loadTeamTasks({ myself: guest, accessToken: "token" } as never);

        expect(await new CheckpointRepository().getCheckpoint(KEY)).toBeNull();
        expect(await new TaskRepository().getTasksByProject(PROJECT_ID)).toHaveLength(0);

        // So the next project load is a full one, and the table refills.
        vi.mocked(loadProjectTasksFromApi).mockResolvedValueOnce(full([hostTask(1)], "T4"));
        await load();
        expect(sinceOfCall(1)).toBeNull();
        expect(await new TaskRepository().getTasksByProject(PROJECT_ID)).toHaveLength(1);
    });
});
