/**
 * The empty sub-task list that survived a project move.
 *
 * Child lists are cached per (parent, project) for 30s. Moving a milestone
 * (or a root task) switches the preview's project OPTIMISTICALLY, so the
 * sub-task block refetches under the DESTINATION project id while the
 * server still has the children in the source — and caches the empty
 * answer. Nothing in `genos:task-touched` describes a move, so that entry
 * stood for the rest of the TTL: the block showed "no sub-tasks" through
 * every remount and only a page reload, which drops the module, fixed it.
 *
 * `genos:tasks-bulk-changed` is what fires once the move has landed, for
 * both projects, and these pin it to dropping the cache.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadSpecificChildTasks } from "../../features/tasks/services/loadSpecificChildTasks";
import { emitTasksBulkChanged } from "../../features/tasks/services/taskEvents";
import { authApi } from "../../services/api";

vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
}));

const myself = {
    teamId: "team1",
    teamName: "Team One",
    userId: "user1",
    userName: "Test User",
    userEmail: "test@test.com",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
    customStatus: "",
};

const DESTINATION_PROJECT = 46;
const SOME_OTHER_PROJECT = 12;

// The cache lives at module scope and is shared by every case in this
// file, so each one works on a parent id of its own.
let nextParentId = 900;
const aParent = () => ++nextParentId;

const serving = (...responses: unknown[][]) => {
    const get = vi.fn();
    responses.forEach((rows) => get.mockResolvedValueOnce({ data: rows }));
    (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get });
    return get;
};

describe("child task lists across a project move", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("serves a repeat read from cache", async () => {
        // The control: without this the assertions below would pass on a
        // cache that never held anything.
        const parent = aParent();
        const get = serving([{ id: 1 }], [{ id: 1 }]);

        await loadSpecificChildTasks(myself, DESTINATION_PROJECT, parent, "tok");
        await loadSpecificChildTasks(myself, DESTINATION_PROJECT, parent, "tok");

        expect(get).toHaveBeenCalledTimes(1);
    });

    it("asks again after a bulk change, and gets the tasks that moved", async () => {
        const parent = aParent();
        const get = serving([], [{ id: 7 }]);

        // The mid-move read: the block already points at the destination,
        // the server has not moved anything into it yet.
        expect(await loadSpecificChildTasks(myself, DESTINATION_PROJECT, parent, "tok")).toEqual(
            []
        );

        emitTasksBulkChanged(DESTINATION_PROJECT);

        expect(await loadSpecificChildTasks(myself, DESTINATION_PROJECT, parent, "tok")).toEqual([
            { id: 7 },
        ]);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("drops lists the event says nothing about", async () => {
        // A move emits for the source and the destination, and the event
        // carries a project — never the parents whose lists changed. A
        // milestone's members are parents in their own right, so the only
        // safe read of any bulk change is "every cached list may be stale".
        const parent = aParent();
        const get = serving([], [{ id: 8 }]);

        await loadSpecificChildTasks(myself, DESTINATION_PROJECT, parent, "tok");

        emitTasksBulkChanged(SOME_OTHER_PROJECT);

        expect(await loadSpecificChildTasks(myself, DESTINATION_PROJECT, parent, "tok")).toEqual([
            { id: 8 },
        ]);
        expect(get).toHaveBeenCalledTimes(2);
    });
});
