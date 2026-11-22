import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadSpecificChildTasks } from "../../features/tasks/services/loadSpecificChildTasks";
import { authApi } from "../../services/api";

vi.mock("../../services/api", () => ({ authApi: vi.fn() }));

const myself = { teamId: "t1" } as never;

describe("loadSpecificChildTasks statuses (MIP-1994)", () => {
    let get: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        get = vi.fn().mockResolvedValue({ data: { tasks: [], statusCounts: { Closed: 3 } } });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get });
    });

    it("sends the statuses, and keeps a different set in its own cache entry", async () => {
        await loadSpecificChildTasks(myself, 5, 700, "tok", ["Open", "WIP"]);
        await loadSpecificChildTasks(myself, 5, 700, "tok", ["Open", "WIP"]);
        expect(get).toHaveBeenCalledTimes(1);
        expect(get.mock.calls[0][0]).toContain("statuses=Open%2CWIP");

        await loadSpecificChildTasks(myself, 5, 700, "tok", ["Open", "WIP", "Closed"]);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("without statuses the request is the old one", async () => {
        await loadSpecificChildTasks(myself, 5, 701, "tok");
        expect(get.mock.calls[0][0]).not.toContain("statuses");
    });
});
