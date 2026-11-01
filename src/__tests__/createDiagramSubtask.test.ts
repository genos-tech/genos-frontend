/**
 * A sub-task made from the diagram stores an empty body, not the default
 * template scaffold (MIP-799): the node is made with one click and usually
 * only renamed, so an untouched scaffold would be stored as written text.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDiagramSubtask } from "../features/tasks/diagram/services/createDiagramSubtask";
import { UserProps } from "../types/admin";

const post = vi.fn();
vi.mock("../services/api", () => ({ authApi: () => ({ post }) }));

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;

describe("createDiagramSubtask", () => {
    beforeEach(() => {
        post.mockReset();
        post.mockResolvedValue({ data: { task: { task_id: 7, displayId: "KDS-7" } } });
    });

    it("posts an empty body", async () => {
        const res = await createDiagramSubtask(myself, 1, 5, "tok");
        expect(res).toEqual({ ok: true, taskId: 7, displayId: "KDS-7" });
        const [url, body] = post.mock.calls[0];
        expect(url).toBe("/task/");
        expect(body.content).toEqual([]);
        expect(body.parent_task_id).toBe(5);
    });
});
