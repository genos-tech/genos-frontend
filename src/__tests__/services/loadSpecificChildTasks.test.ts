import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadSpecificChildTasks } from "../../features/tasks/services/loadSpecificChildTasks";
import { emitTaskTouched } from "../../features/tasks/services/taskEvents";
import { authApi } from "../../services/api";

vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
}));

const myself = {
    teamId: "team1",
    teamName: "Team One",
    userId: "user1",
    userName: "U",
    userEmail: "u@test.com",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
    customStatus: "",
};

// A parent (id 10) with one subtask (id 20). The subtask's status flips
// between the two fetches so we can prove a refetch actually happened.
const firstList = [{ id: 20, status: { status: "Open" } }];
const secondList = [{ id: 20, status: { status: "Done" } }];

describe("loadSpecificChildTasks — cache invalidation", () => {
    let mockGet: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockGet = vi
            .fn()
            .mockResolvedValueOnce({ data: firstList })
            .mockResolvedValueOnce({ data: secondList });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });
    });

    afterEach(() => {
        vi.clearAllMocks();
        // Let the 30s TTL entries age out between tests via a distinct
        // parent id per test instead of reaching into the module cache.
    });

    it("serves the cached list on a repeat call within the TTL", async () => {
        const a = await loadSpecificChildTasks(myself, 5, 100, "token");
        const b = await loadSpecificChildTasks(myself, 5, 100, "token");
        expect(mockGet).toHaveBeenCalledTimes(1);
        expect(a).toEqual(firstList);
        expect(b).toEqual(firstList); // same cached reference
    });

    it("refetches after a subtask 'update' event invalidates the cache", async () => {
        const first = await loadSpecificChildTasks(myself, 5, 101, "token");
        expect(first?.[0].status.status).toBe("Open");

        // A subtask's status was edited elsewhere — useSendUpdatedTask
        // emits an "update" for the child id (20), which must drop the
        // parent's cached child list.
        emitTaskTouched(20, "update");

        const second = await loadSpecificChildTasks(myself, 5, 101, "token");
        expect(mockGet).toHaveBeenCalledTimes(2);
        expect(second?.[0].status.status).toBe("Done");
    });
});
