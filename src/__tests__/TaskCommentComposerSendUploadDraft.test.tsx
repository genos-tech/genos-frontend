/**
 * Characterization of the task-comment composer's send / upload / draft logic (MIP-1161).
 *
 * Written against the code BEFORE the shared hook existed and kept unchanged after it. See
 * `helpers_composerHarness.tsx` for the BlockNote seam and `ChatComposerSendUploadDraft.test.tsx`
 * for the chat / thread counterpart.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BnTaskCommentEditor } from "../components/editors/bnTaskCommentEditor";
import { emitTaskTouched } from "../features/tasks/services/taskEvents";
import { channelService } from "../services/channel/channelService";
import { harness, lastEditor, para, pressChord, typeInto } from "./helpers_composerHarness";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));
vi.mock("@mui/joy/styles", async (original) => ({
    ...(await original<typeof import("@mui/joy/styles")>()),
    useColorScheme: () => ({ mode: "light" }),
}));
vi.mock("@blocknote/mantine", async () =>
    (await import("./helpers_composerHarness")).blockNoteMantineMock()
);
vi.mock("../components/editors/genos/useGenosEditor", async () =>
    (await import("./helpers_composerHarness")).useGenosEditorMock()
);
vi.mock("../components/editors/genos/genosSchema", () => ({ useGenosSchema: () => ({}) }));
vi.mock("../components/editors/genos/GenosSuggestionMenus", () => ({
    GenosSuggestionMenus: () => null,
}));
vi.mock("../components/editors/genos/GenosToolbars", async () =>
    (await import("./helpers_composerHarness")).genosToolbarsMock()
);
vi.mock("../components/editors/blockNoteI18n", () => ({ useBlockNoteDictionary: () => ({}) }));
vi.mock("../components/editors/sub/EditorSendButton", async () =>
    (await import("./helpers_composerHarness")).sendButtonMock()
);
vi.mock("../components/ui/feedback/FileUploadProgress", async () =>
    (await import("./helpers_composerHarness")).uploadChromeMock()
);
vi.mock("../components/ui/emoji/EmojiPicker", () => ({ EmojiPicker: () => null }));
vi.mock("../components/ui/gif/GifPicker", () => ({ GifPicker: () => null }));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
}));
vi.mock("../context/MentionGroupsContext", () => ({
    useMentionGroupsContext: () => ({ mentionGroups: [] }),
}));
vi.mock("../hooks/common/UrlLinkModalContext", () => ({ useUrlLinkModal: () => null }));
vi.mock("../hooks/common/useAnchorClickIntercept", () => ({ useAnchorClickIntercept: () => {} }));
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../services/uploadLimit", () => ({
    resolveUploadLimitBytes: vi.fn(async () => 1024),
    invalidateUploadLimit: vi.fn(),
}));
vi.mock("../features/tasks/services/taskEvents", () => ({ emitTaskTouched: vi.fn() }));
vi.mock("../services/requestErrorNotifier", () => ({
    emitRequestError: vi.fn(),
    notifyActionError: vi.fn(),
}));

const flush = () =>
    act(async () => {
        for (let i = 0; i < 8; i += 1) await Promise.resolve();
    });

const draftKey = (key: string) => `genos-editor-draft:v1:${key}`;
const readStoredDraft = (key: string) => {
    const raw = localStorage.getItem(draftKey(key));
    return raw ? JSON.parse(raw) : null;
};
const file = (name: string, type: string, size = 10) => {
    const f = new File(["x"], name, { type });
    Object.defineProperty(f, "size", { value: size });
    return f;
};
const deferred = <T,>() => {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

const myself = { userId: "u1", userName: "Me", userEmail: "me@x.io" } as any;
const task = {
    id: 42,
    displayId: "PRJ-42",
    project: { projectId: 7, projectName: "Proj", isPrivate: true },
} as any;

let uploadInline: ReturnType<typeof vi.spyOn>;
const setTaskComments = vi.fn();
const setTaskCommentLines = vi.fn();
const setTaskUpdated = vi.fn();
const clearPendingFiles = vi.fn();
const setIsTaskCommentUpdated = vi.fn();
const emit = vi.fn();

const props = (over: Record<string, unknown> = {}) =>
    ({
        useTEM: { teamMembers: [], teamMemberProfiles: [] },
        myself,
        setMyself: vi.fn(),
        socket: { emit },
        task,
        setTaskUpdated,
        taskComments: [{ commentId: 1 }],
        setTaskComments,
        useUISM: {},
        taskCommentLines: 99,
        setTaskCommentLines,
        useCM: {},
        useTM: { setIsTaskCommentUpdated },
        uploadChannelId: "pm-channel",
        clearPendingFiles,
        ...over,
    }) as any;

const mount = (over: Record<string, unknown> = {}) =>
    render(<BnTaskCommentEditor {...props(over)} />);
const remount = (view: ReturnType<typeof render>, over: Record<string, unknown>) =>
    view.rerender(<BnTaskCommentEditor {...props(over)} />);

beforeEach(() => {
    harness.reset();
    localStorage.clear();
    vi.clearAllMocks();
    uploadInline = vi
        .spyOn(channelService, "uploadInlineFile")
        .mockImplementation(async (_c: string, f: File) => `https://media/${f.name}`);
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const sendButton = () => screen.getByTestId("send") as HTMLButtonElement;
const overlay = () => screen.getByTestId("overlay");
const badge = () => screen.getByTestId("badge");

describe("BnTaskCommentEditor", () => {
    describe("Send button and the chord", () => {
        it("enables Send only with something to send", () => {
            mount();
            expect(sendButton().disabled).toBe(true);
            typeInto("hi");
            expect(sendButton().disabled).toBe(false);
        });

        it("sends on Cmd/Ctrl+Enter only", async () => {
            mount();
            typeInto("hi");
            await pressChord({ key: "Enter" });
            expect(emit).not.toHaveBeenCalled();
            await pressChord({ metaKey: true });
            expect(emit).toHaveBeenCalledTimes(1);
            typeInto("again");
            await pressChord({ ctrlKey: true });
            expect(emit).toHaveBeenCalledTimes(2);
        });

        it("mirrors the local line count up to the task page", () => {
            mount();
            typeInto("hi");
            expect(setTaskCommentLines).toHaveBeenLastCalledWith(2);
        });

        it("tells the task page the comment was touched on blur", () => {
            mount();
            harness.view?.onBlur?.();
            expect(setTaskUpdated).toHaveBeenCalledWith(true);
        });
    });

    describe("send", () => {
        it("appends an optimistic row, clears the composer, then emits the task_comment POST", async () => {
            mount();
            typeInto("hello");
            await pressChord({ metaKey: true });

            // optimistic row
            expect(setTaskComments).toHaveBeenCalledTimes(1);
            const next = setTaskComments.mock.calls[0][0];
            expect(next).toHaveLength(2);
            expect(next[1]).toMatchObject({
                projectId: 7,
                taskId: 42,
                senderId: "u1",
                senderName: "Me",
                commentId: 2,
                isEdited: false,
            });
            expect(next[1].commentBody).toHaveLength(2);
            expect(next[1].commentBody[0].content[0].text).toBe("hello");
            expect(next[1].commentBody[1].content).toEqual([]);

            // composer emptied, Send disabled, line count reset to 0
            expect(lastEditor().document[0].content).toEqual([]);
            expect(sendButton().disabled).toBe(true);
            expect(setTaskCommentLines).toHaveBeenLastCalledWith(0);

            expect(emit).toHaveBeenCalledTimes(1);
            const [event, payload] = emit.mock.calls[0];
            expect(event).toBe("task_comment");
            expect(payload).toMatchObject({
                method_type: "POST",
                project_id: 7,
                project_name: "Proj",
                task_id: 42,
                display_id: "PRJ-42",
                is_private: true,
            });
            expect(payload.comment_body).toEqual(next[1].commentBody);
        });

        it("on ack: refetch signal plus task-touched", async () => {
            mount();
            typeInto("hello");
            await pressChord({ metaKey: true });
            expect(setIsTaskCommentUpdated).not.toHaveBeenCalled();
            emit.mock.calls[0][2]({});
            expect(setIsTaskCommentUpdated).toHaveBeenCalledWith({
                isUpdate: true,
                scrollToBottom: true,
            });
            expect(emitTaskTouched).toHaveBeenCalledWith(42, "comment");
        });

        it("does nothing without a socket, without a task id, or when empty", async () => {
            const view = mount({ socket: null });
            typeInto("hello");
            await pressChord({ metaKey: true });
            expect(emit).not.toHaveBeenCalled();
            expect(lastEditor().document[0].content[0].text).toBe("hello");

            remount(view, { socket: { emit }, task: { ...task, id: 0 } });
            await pressChord({ metaKey: true });
            expect(emit).not.toHaveBeenCalled();

            remount(view, {});
            typeInto("");
            await pressChord({ metaKey: true });
            expect(emit).not.toHaveBeenCalled();
        });

        it("is held while an inline upload is in flight", async () => {
            const pending = deferred<string>();
            uploadInline.mockReturnValue(pending.promise);
            mount();
            typeInto("hello");
            let uploading!: Promise<string>;
            act(() => {
                uploading = lastEditor().options.uploadFile(file("a.png", "image/png"));
            });
            expect(badge().getAttribute("data-count")).toBe("1");
            expect(sendButton().disabled).toBe(true);
            await pressChord({ metaKey: true });
            expect(emit).not.toHaveBeenCalled();
            await act(async () => {
                pending.resolve("https://media/a.png");
                await uploading;
            });
            expect(sendButton().disabled).toBe(false);
        });
    });

    describe("uploads are only available with an upload channel", () => {
        it("gives BlockNote an uploadFile and the toolbar an attach button when a channel is set", () => {
            mount();
            expect(typeof lastEditor().options.uploadFile).toBe("function");
            expect(harness.toolbar?.onAttach).toBeTypeOf("function");
        });

        it("has neither without one", () => {
            mount({ uploadChannelId: undefined });
            expect(lastEditor().options.uploadFile).toBeUndefined();
            expect(harness.toolbar?.onAttach).toBeUndefined();
        });

        it("uploads what the native picker returns to the channel", async () => {
            const view = mount();
            const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
            await act(async () => {
                fireEvent.change(input, { target: { files: [file("p.png", "image/png")] } });
            });
            await flush();
            expect(uploadInline).toHaveBeenCalledWith("pm-channel", expect.any(File));
            expect(lastEditor().document.some((b: any) => b.props?.name === "p.png")).toBe(true);
            expect(input.value).toBe("");
        });

        it("the picker does nothing without a channel", async () => {
            const view = mount({ uploadChannelId: undefined });
            const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
            await act(async () => {
                fireEvent.change(input, { target: { files: [file("p.png", "image/png")] } });
            });
            await flush();
            expect(uploadInline).not.toHaveBeenCalled();
        });
    });

    describe("files dropped on the comment tab (pendingFiles)", () => {
        it("claims the queue FIRST (clears it before any upload settles) and uploads in series", async () => {
            const first = deferred<string>();
            const second = deferred<string>();
            uploadInline.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
            const view = mount();
            await act(async () =>
                remount(view, {
                    pendingFiles: [file("a.png", "image/png"), file("b.pdf", "application/pdf")],
                })
            );
            expect(clearPendingFiles).toHaveBeenCalledTimes(1);
            expect(overlay().getAttribute("data-open")).toBe("true");
            expect(overlay().getAttribute("data-detail")).toBe("a.png (1 / 2)");
            expect(uploadInline).toHaveBeenCalledWith("pm-channel", expect.any(File));
            expect(sendButton().disabled).toBe(true);

            await act(async () => first.resolve("https://media/a.png"));
            await flush();
            expect(overlay().getAttribute("data-detail")).toBe("b.pdf (2 / 2)");
            await act(async () => second.resolve("https://media/b.pdf"));
            await flush();
            const blocks = lastEditor().document;
            expect(blocks.find((b: any) => b.type === "image")?.props.url).toBe(
                "https://media/a.png"
            );
            expect(blocks.find((b: any) => b.type === "file")?.props.url).toBe(
                "https://media/b.pdf"
            );
            expect(overlay().getAttribute("data-open")).toBe("false");
            expect(clearPendingFiles).toHaveBeenCalledTimes(1);
        });

        // MIP-1224: this used to pin "does not tick the upload badge for dropped files (raw
        // uploader)". A drop now goes through the guarded, counted uploader like every composer.
        it("ticks the upload badge for dropped files (guarded, counted uploader)", async () => {
            const first = deferred<string>();
            uploadInline.mockReturnValueOnce(first.promise);
            const view = mount();
            await act(async () => remount(view, { pendingFiles: [file("a.png", "image/png")] }));
            expect(overlay().getAttribute("data-open")).toBe("true");
            await act(async () => first.resolve("u"));
            await flush();
        });

        it("clears the queue and uploads nothing without a channel", async () => {
            const view = mount({ uploadChannelId: undefined });
            await act(async () =>
                remount(view, {
                    uploadChannelId: undefined,
                    pendingFiles: [file("a.png", "image/png")],
                })
            );
            await flush();
            expect(clearPendingFiles).toHaveBeenCalledTimes(1);
            expect(uploadInline).not.toHaveBeenCalled();
        });

        it("drops oversize files up front", async () => {
            const view = mount();
            await flush();
            await act(async () =>
                remount(view, {
                    pendingFiles: [
                        file("huge.pdf", "application/pdf", 5000),
                        file("small.pdf", "application/pdf"),
                    ],
                })
            );
            await flush();
            expect(uploadInline).toHaveBeenCalledTimes(1);
            expect((uploadInline.mock.calls[0][1] as File).name).toBe("small.pdf");
        });

        it("a remount while the queue is still the same array inserts nothing twice (claimed first)", async () => {
            const queue = [file("a.png", "image/png")];
            const view = mount();
            await act(async () => remount(view, { pendingFiles: queue }));
            await flush();
            view.unmount();
            // The parent already cleared its queue, so the fresh mount sees none.
            mount({ pendingFiles: [] });
            await flush();
            expect(uploadInline).toHaveBeenCalledTimes(1);
        });
    });

    describe("drafts", () => {
        beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));

        it("persists under task-comment:{id} after 400 ms", () => {
            mount();
            typeInto("hello", 1);
            act(() => vi.advanceTimersByTime(399));
            expect(readStoredDraft("task-comment:42")).toBeNull();
            act(() => vi.advanceTimersByTime(1));
            expect(readStoredDraft("task-comment:42")[0].content[0].text).toBe("hello");
        });

        it("restores per task and swaps on task change", () => {
            const view = mount();
            typeInto("for 42", 1);
            act(() => vi.advanceTimersByTime(400));
            remount(view, { task: { ...task, id: 43 } });
            expect(lastEditor().document[0].content).toEqual([]);
            localStorage.setItem(
                draftKey("task-comment:44"),
                JSON.stringify([para("x"), para("")])
            );
            remount(view, { task: { ...task, id: 44 } });
            expect(lastEditor().document[0].content[0].text).toBe("x");
            remount(view, {});
            expect(lastEditor().document[0].content[0].text).toBe("for 42");
        });

        it("a send clears the stored draft at once", async () => {
            mount();
            typeInto("hello", 1);
            act(() => vi.advanceTimersByTime(400));
            typeInto("hello again", 1);
            await pressChord({ metaKey: true });
            act(() => vi.advanceTimersByTime(800));
            expect(readStoredDraft("task-comment:42")).toBeNull();
        });
    });
});
