/**
 * Where a to-do made from a message points (MIP-1436).
 *
 * A task comment used to link to `/workspace/chat/pm/{numeric project id}/thread/...`; a PM chat URL
 * carries the channel UUID now, so that opened "No conversation selected". It links to the task
 * page now. A project-chat message returned no link at all, so "Add to To-Do" on one made nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appendTodoFromMessage } from "../features/chat/components/todo/services/appendTodoFromMessage";
import { createTodoItem } from "../features/chat/components/todo/services/todoItems";

vi.mock("../features/chat/components/todo/services/todoItems", () => ({
    createTodoItem: vi.fn(async (_t: unknown, _m: unknown, input: unknown) => ({ input })),
}));

const ORIGIN = window.location.origin;
const myself = { userId: "u-1" } as never;

const base = {
    chatId: 1,
    chatType: 1,
    isThread: false,
    messageId: 9,
    messageText: "hello",
    threadId: null as number | null,
};

/** The link and the "From ..." text that went into the new to-do's notes. */
const sent = async (source: Parameters<typeof appendTodoFromMessage>[2]) => {
    const created = await appendTodoFromMessage("tok", myself, source);
    const call = vi.mocked(createTodoItem).mock.calls.at(-1);
    const notes = JSON.stringify(call?.[2]) ?? "";
    return {
        created,
        href: notes.match(/"href":"([^"]+)"/)?.[1],
        from: notes.match(/"text":"([^"]*): "/)?.[1],
        title: (call?.[2] as { title?: string } | undefined)?.title,
    };
};

beforeEach(() => vi.mocked(createTodoItem).mockClear());
afterEach(() => vi.clearAllMocks());

describe("a task comment", () => {
    const source = {
        ...base,
        chatId: 961,
        chatType: 3,
        isThread: true,
        messageId: 2,
        threadId: 12978,
        taskComment: { projectId: 961, taskId: 12978, commentId: 2 },
    };

    it("links to the task page, which opens from anywhere", async () => {
        const r = await sent(source);
        expect(r.href).toBe(`${ORIGIN}/workspace/tasks/project/961/task/12978/comment/2`);
        expect(r.from).toBe("From task comment");
    });

    it("no longer links through a chat URL with the numeric project id in it", async () => {
        const r = await sent(source);
        expect(r.href).not.toContain("/workspace/chat/");
    });
});

describe("a project-chat message (chat type 3, not a thread)", () => {
    const pm = { ...base, chatId: "65196ba2-4a0e" as unknown as number, chatType: 3 };

    it("that is a task's card links to the task, and makes a to-do", async () => {
        const r = await sent({ ...pm, task: { projectId: 961, taskId: 12978 } });
        expect(r.created).toBeTruthy();
        expect(r.href).toBe(`${ORIGIN}/workspace/tasks/project/961/task/12978`);
        expect(r.from).toBe("From task");
    });

    it("that is any other message links to itself in the project chat", async () => {
        const r = await sent(pm);
        expect(r.created).toBeTruthy();
        expect(r.href).toBe(`${ORIGIN}/workspace/chat/pm/65196ba2-4a0e/message/9`);
        expect(r.from).toBe("From project chat");
    });
});

describe("the other chats are as they were", () => {
    it.each([
        [{ ...base, chatType: 1 }, "/workspace/chat/dm/1/message/9", "From DM"],
        [{ ...base, chatType: 2 }, "/workspace/chat/gm/1/message/9", "From GM"],
        [{ ...base, chatType: 4 }, "/workspace/chat/mdm/1/message/9", "From multi-user DM"],
        [
            { ...base, chatType: 1, isThread: true, threadId: 5 },
            "/workspace/chat/dm/1/thread/5/message/9",
            "From DM thread",
        ],
    ])("%j", async (source, path, from) => {
        const r = await sent(source);
        expect(r.href).toBe(`${ORIGIN}${path}`);
        expect(r.from).toBe(from);
    });

    it("an unknown chat type makes no to-do", async () => {
        const r = await sent({ ...base, chatType: 9 });
        expect(r.created).toBeUndefined();
        expect(createTodoItem).not.toHaveBeenCalled();
    });

    it("the title is the first line, or the untitled text", async () => {
        expect((await sent({ ...base, messageText: "  buy milk  " })).title).toBe("buy milk");
        expect((await sent({ ...base, messageText: "" })).title).toBe("Untitled to-do");
    });
});
