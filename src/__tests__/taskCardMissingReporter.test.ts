/**
 * MIP-1729: a task or milestone whose reporter row is gone.
 *
 * `tasks.reporter` is SET_NULL, so a hard-deleted account leaves a task with no reporter.
 * `GET /task/getTask/` sends exactly that, `"reporter": null`, although `TaskProps.reporter`
 * is typed non-null. A save of such a task must go out (it once threw at
 * `updatedTask.reporter.userId`, before the PUT), and the thread reply's template says
 * "Deleted user" in the muted italic the server writes on the card.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendUpdatedSpecificTask } from "../features/tasks/services/sendUpdatedSpecificTask";
import {
    milestoneMessageTemplate,
    taskMessageTemplate,
} from "../features/tasks/utils/TaskMessageTemplate";
import { UserProps } from "../types/admin";
import { TaskProps } from "../types/tasks";

const put = vi.fn();

vi.mock("../services/api", () => ({ authApi: () => ({ put }) }));
vi.mock("../db/services/task-full.service", () => ({
    cacheFullTask: vi.fn().mockResolvedValue(undefined),
    invalidateCachedFullTask: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../features/tasks/services/addTask", () => ({
    addTask: vi.fn().mockResolvedValue(null),
}));
vi.mock("../features/tasks/services/uploadTaskAttachments", () => ({
    uploadTaskAttachments: vi.fn().mockResolvedValue([]),
}));
vi.mock("../features/tasks/services/taskEvents", () => ({
    emitTasksBulkChanged: vi.fn(),
    emitTaskMetadataSaved: vi.fn(),
    emitTaskTouched: vi.fn(),
}));

const myself = {
    userId: "u-me",
    userName: "Me",
    userEmail: "me@x.dev",
    teamId: "t1",
} as unknown as UserProps;

// The people exactly as `GET /task/getTask/` writes them (origin/views/task/task_views.py).
const person = (id: string, name: string) => ({
    teamId: "t1",
    userId: id,
    userName: name,
    userEmail: `${name.toLowerCase()}@x.dev`,
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
    customStatus: "",
});

// A task as `GET /task/getTask/` returns it for a hard-deleted reporter: `"reporter": null`.
const serverTask = (reporter: ReturnType<typeof person> | null) =>
    ({
        id: 42,
        displayId: "KDS-42",
        title: "A task",
        body: [],
        project: { projectId: 1, projectName: "Kds", projectCode: "KDS", systemUserId: "sys" },
        assignee: person("u-ann", "Ann"),
        reporter,
        priority: { priority: "High" },
        effortLevel: { level: "Low" },
        status: { status: "Deleted" },
        dueDate: "2026-12-01",
        links: [],
        tags: [],
        attachments: [],
        parentTaskId: null,
        threadId: null,
    }) as unknown as TaskProps;

type Node = { text?: string; type?: string; styles?: Record<string, unknown>; props?: unknown };
type Block = { content: Node[] };
const reporterRow = (blocks: unknown[]): Node[] =>
    (blocks as Block[]).find((b) => b.content[0]?.text === "Reporter: ")!.content;

const DELETED_USER_NODE = {
    styles: { italic: true, textColor: "gray" },
    text: "Deleted user",
    type: "text",
};

describe("the task card names a reporter whose account is gone", () => {
    it("reads Deleted user, muted italic, for the server's null reporter", () => {
        const row = reporterRow(taskMessageTemplate(myself, serverTask(null)));
        expect(row).toEqual([
            { styles: { bold: true }, text: "Reporter: ", type: "text" },
            DELETED_USER_NODE,
        ]);
    });

    it("does not mention anybody for it (the viewer least of all)", () => {
        const blocks = taskMessageTemplate(myself, serverTask(null)) as Block[];
        const mentions = blocks.flatMap((b) => b.content).filter((n) => n.type === "mention");
        // Only the assignee: no mention node for the missing reporter.
        expect(mentions).toHaveLength(1);
    });

    it("reads the same when the field is absent (undefined)", () => {
        const task = serverTask(null) as unknown as Record<string, unknown>;
        delete task.reporter;
        const row = reporterRow(taskMessageTemplate(myself, task as unknown as TaskProps));
        expect(row[1]).toEqual(DELETED_USER_NODE);
    });

    it("leaves a task that HAS a reporter exactly as it was: a mention", () => {
        const row = reporterRow(taskMessageTemplate(myself, serverTask(person("u-bo", "Bo"))));
        expect(row).toEqual([
            { styles: { bold: true }, text: "Reporter: ", type: "text" },
            {
                props: {
                    avatarImgPath: [""],
                    customStatus: "N/A",
                    teamId: "t1",
                    teamName: "N/A",
                    userEmail: "bo@x.dev",
                    userId: "u-bo",
                    userName: "Bo",
                },
                type: "mention",
            },
        ]);
    });

    it("keeps every other row for a missing reporter as it is for a present one", () => {
        const without = taskMessageTemplate(myself, serverTask(null)) as Block[];
        const withOne = taskMessageTemplate(myself, serverTask(person("u-bo", "Bo"))) as Block[];
        const others = (blocks: Block[]) =>
            blocks.filter((b) => b.content[0]?.text !== "Reporter: ");
        expect(others(without)).toEqual(others(withOne));
    });
});

describe("the milestone card names a reporter whose account is gone", () => {
    const milestone = { title: "Launch", status: "Open", priority: "High", dueDate: null };
    const build = (reporter: UserProps | null | undefined) =>
        milestoneMessageTemplate(
            myself,
            milestone as never,
            "Sprint 1",
            reporter,
            []
        ) as unknown[];

    it("reads Deleted user, muted italic, for no reporter", () => {
        expect(reporterRow(build(null))[1]).toEqual(DELETED_USER_NODE);
        expect(reporterRow(build(undefined))[1]).toEqual(DELETED_USER_NODE);
    });

    it("leaves a milestone that HAS a reporter as it was: a mention", () => {
        const bo = person("u-bo", "Bo") as unknown as UserProps;
        const node = reporterRow(build(bo))[1];
        expect(node.type).toBe("mention");
        expect(node.props).toMatchObject({
            userId: "u-bo",
            userName: "Bo",
            userEmail: "bo@x.dev",
        });
    });
});

describe("a save of a task whose reporter is gone", () => {
    beforeEach(() => {
        put.mockReset();
        put.mockResolvedValue({ data: { task: { ts_updated_at: "now" } } });
    });

    it("goes out with a null reporter (the server drops it)", async () => {
        await sendUpdatedSpecificTask(null, myself, serverTask(null), true, "tok");
        expect(put).toHaveBeenCalledTimes(1);
        const body = put.mock.calls[0][1] as Record<string, unknown>;
        expect(body.reporter).toBeNull();
    });

    it("still sends the reporter's id when there is one", async () => {
        await sendUpdatedSpecificTask(null, myself, serverTask(person("u-bo", "Bo")), true, "tok");
        const body = put.mock.calls[0][1] as Record<string, unknown>;
        expect(body.reporter).toBe("u-bo");
    });
});
