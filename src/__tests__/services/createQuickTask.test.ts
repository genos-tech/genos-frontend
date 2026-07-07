import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQuickTask } from "../../features/tasks/services/createQuickTask";

const mockMyself = {
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

const baseProps = {
    myself: mockMyself,
    accessToken: "token123",
    projectId: 42,
    title: "Quick task",
    parentTaskId: 7,
    rootTaskId: 7,
    milestoneId: null,
};

const okResponse = (body: unknown) => ({
    ok: true,
    status: 201,
    json: async () => body,
});

describe("createQuickTask", () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue(okResponse({ task: { task_id: 123 } }));
        vi.stubGlobal("fetch", mockFetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const sentBody = () => JSON.parse(mockFetch.mock.calls[0][1].body as string);

    it("keeps the title-only defaults (backward compat for TaskSubTasksBlock)", async () => {
        await createQuickTask(baseProps);

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/task/"),
            expect.objectContaining({ method: "POST" })
        );
        const body = sentBody();
        expect(body.assignee).toBe("user1");
        expect(body.reporter).toBe("user1");
        expect(body.status).toBe("Open");
        expect(body.priority).toBeNull();
        expect(body.effort_level).toBeNull();
        expect(body.due_date).toBeNull();
        expect(body.parent_task_id).toBe(7);
        expect(body.root_task_id).toBe(7);
        expect(body.is_init_task).toBe(false);
        expect(body).not.toHaveProperty("milestone");
    });

    it("threads explicit metadata into the snake_case body keys", async () => {
        await createQuickTask({
            ...baseProps,
            milestoneId: 5,
            assigneeId: "user2",
            status: "WIP",
            priority: "High",
            effortLevel: "Low",
            dueDate: "2026-08-01",
        });

        const body = sentBody();
        expect(body.assignee).toBe("user2");
        expect(body.status).toBe("WIP");
        expect(body.priority).toBe("High");
        expect(body.effort_level).toBe("Low");
        expect(body.due_date).toBe("2026-08-01");
        expect(body.milestone).toBe(5);
    });

    it("sends assignee null when explicitly unassigned", async () => {
        await createQuickTask({ ...baseProps, assigneeId: null });
        expect(sentBody().assignee).toBeNull();
    });

    it("returns the created task id from the POST response", async () => {
        const result = await createQuickTask(baseProps);
        expect(result).toEqual({ taskId: 123, displayId: null });
    });

    it("surfaces the backend-computed displayId when present", async () => {
        mockFetch.mockResolvedValue(okResponse({ task: { task_id: 123, displayId: "PRJ-45" } }));
        expect(await createQuickTask(baseProps)).toEqual({ taskId: 123, displayId: "PRJ-45" });
    });

    it("returns nulls when the response body is malformed", async () => {
        mockFetch.mockResolvedValue(okResponse({ unexpected: true }));
        expect(await createQuickTask(baseProps)).toEqual({ taskId: null, displayId: null });

        mockFetch.mockResolvedValue({
            ok: true,
            status: 201,
            json: async () => {
                throw new Error("not json");
            },
        });
        expect(await createQuickTask(baseProps)).toEqual({ taskId: null, displayId: null });
    });

    it("throws on a non-ok response", async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
        await expect(createQuickTask(baseProps)).rejects.toThrow("Quick task create failed");
    });

    it("throws when the access token is missing", async () => {
        await expect(createQuickTask({ ...baseProps, accessToken: null })).rejects.toThrow(
            "Missing access token"
        );
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
