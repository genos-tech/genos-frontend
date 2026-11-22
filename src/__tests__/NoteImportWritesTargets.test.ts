/**
 * MIP-1952: the import's upload + body rewrite must go to the endpoint of
 * the note's own kind (task / chat notes have their own attachment and
 * update endpoints and ACL), not always `/note/personal/`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { putNoteBody, uploadNoteAsset } from "../features/notes/common/services/noteImportWrites";
import { authApi } from "../services/api";

vi.mock("../services/api", () => ({ authApi: vi.fn() }));

const myself = { userId: "u1", teamId: "t1" } as never;

const stubFetch = () => {
    const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ noteAttachmentUrl: "/media/a.png" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
};

afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(authApi).mockReset();
});

describe("uploadNoteAsset", () => {
    const file = new File([new Uint8Array(3)], "image-1.png", { type: "image/png" });
    const call = async (target?: Parameters<typeof uploadNoteAsset>[0]["target"]) => {
        const fetchMock = stubFetch();
        await uploadNoteAsset({ noteId: 7, file, uploaderId: "u1", accessToken: "tok", target });
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: FormData }];
        return { url, form: init.body };
    };

    it("defaults to the personal endpoint", async () => {
        expect((await call()).url).toMatch(/\/note\/personal\/attachment\/$/);
    });

    it("posts a task note's file to the task endpoint", async () => {
        const { url, form } = await call({ kind: "task" });
        expect(url).toMatch(/\/note\/task\/attachment\/$/);
        expect(form.get("note_id")).toBe("7");
    });

    it("posts a chat note's file to the chat endpoint with the channel fields", async () => {
        const { url, form } = await call({
            kind: "chat",
            chatType: 2,
            chatId: 55,
            isThread: false,
            threadId: 0,
        });
        expect(url).toMatch(/\/note\/chat\/attachment\/$/);
        expect(form.get("chat_type")).toBe("2");
        expect(form.get("chat_id")).toBe("55");
        expect(form.get("is_thread")).toBe("false");
        expect(form.get("thread_id")).toBe("0");
    });
});

describe("putNoteBody", () => {
    it.each([
        [undefined, "/note/personal/"],
        [{ kind: "task" as const }, "/note/task/"],
        [
            { kind: "chat" as const, chatType: 2, chatId: 1, isThread: false, threadId: 0 },
            "/note/chat/",
        ],
    ])("PUTs to the note kind's endpoint (%#)", async (target, path) => {
        const put = vi.fn(async () => ({}));
        vi.mocked(authApi).mockReturnValue({ put } as never);
        await putNoteBody({
            myself,
            noteId: 7,
            title: "T",
            body: [],
            accessToken: "tok",
            target,
        });
        expect(put).toHaveBeenCalledWith(path, expect.objectContaining({ note_id: 7 }));
    });
});
