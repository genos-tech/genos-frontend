/**
 * MIP-1952: importing Markdown into a TASK or CHAT note creates the note
 * without the `data:` pixels (the API refuses a body over ~2.5 MB), uploads
 * each image to that note kind's attachment endpoint and PUTs the rewritten
 * body, as My Notes already does (MIP-1946).
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEmptyChatNote } from "../features/notes/chat-notes/services/createEmptyChatNote";
import { createEmptyTaskNote } from "../features/notes/task-notes/services/createEmptyTaskNote";
import { useNoteManagement } from "../hooks/notes/useNoteManagement";
import { authApi } from "../services/api";
import type { UserProps } from "../types/admin";

vi.mock("../features/notes/task-notes/services/createEmptyTaskNote", () => ({
    createEmptyTaskNote: vi.fn(),
}));
vi.mock("../features/notes/chat-notes/services/createEmptyChatNote", () => ({
    createEmptyChatNote: vi.fn(),
}));
vi.mock("../services/api", () => ({ authApi: vi.fn() }));
vi.mock("../features/notes/task-notes/services/loadTaskNoteMeta", () => ({
    loadTaskNoteMeta: vi.fn(async () => []),
}));
vi.mock("../features/notes/chat-notes/services/loadChatNoteMeta", () => ({
    loadChatNoteMeta: vi.fn(async () => []),
}));

const myself = { teamId: "team-1", userId: "user-1" } as UserProps;
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const DATA = "data:image/png;base64,iVBORw0KGgo=";
const body = [{ type: "image", props: { url: DATA } }];

const setup = () => {
    const put = vi.fn(async () => ({}));
    vi.mocked(authApi).mockReturnValue({ put } as never);
    const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ noteAttachmentUrl: "/media/n/a.png" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    return { put, fetchMock };
};

afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(authApi).mockReset();
});

describe("import images into task and chat notes", () => {
    it("task note: created blank, uploaded to /note/task/attachment/, body PUT to /note/task/", async () => {
        const { put, fetchMock } = setup();
        vi.mocked(createEmptyTaskNote).mockResolvedValue({ noteId: 9, body: [] });
        const onReport = vi.fn();
        const hook = renderHook(() => useNoteManagement(myself, "tok"));
        await settle();
        await act(async () => {
            await hook.result.current.handleCreateNewTaskNote(null, 1, 2, undefined, {
                title: "T",
                body,
                skipOpenTab: true,
                dataImages: { uploadLimitBytes: null, onReport },
            });
        });
        const created = vi.mocked(createEmptyTaskNote).mock.calls[0][6] as {
            props: { url: string };
        }[];
        expect(JSON.stringify(created)).not.toContain("data:");
        expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toMatch(
            /\/note\/task\/attachment\/$/
        );
        expect(put).toHaveBeenCalledWith(
            "/note/task/",
            expect.objectContaining({ note_id: 9, title: "T" })
        );
        expect(JSON.stringify(put.mock.calls[0])).not.toContain("data:");
        expect(onReport).toHaveBeenCalledWith(expect.objectContaining({ uploaded: 1 }));
    });

    it("chat note: upload carries the channel fields, body PUT to /note/chat/", async () => {
        const { put, fetchMock } = setup();
        vi.mocked(createEmptyChatNote).mockResolvedValue({ noteId: 11, body: [] });
        const hook = renderHook(() => useNoteManagement(myself, "tok"));
        await settle();
        await act(async () => {
            await hook.result.current.handleCreateNewChatNote(null, 2, 55, false, 0, undefined, {
                title: "C",
                body,
                dataImages: { uploadLimitBytes: null },
            });
        });
        expect(JSON.stringify(vi.mocked(createEmptyChatNote).mock.calls[0][8])).not.toContain(
            "data:"
        );
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: FormData }];
        expect(url).toMatch(/\/note\/chat\/attachment\/$/);
        expect(init.body.get("chat_id")).toBe("55");
        expect(put).toHaveBeenCalledWith("/note/chat/", expect.objectContaining({ note_id: 11 }));
    });
});
