/**
 * Characterization of the three edit-in-place composers (MIP-1161): edit a chat message, edit a
 * thread reply, edit a task comment. Save / Cancel, the Cmd/Ctrl+Enter chord, what is captured
 * and when, and what each does about uploads (nothing gates Save).
 *
 * Written against the code BEFORE the shared hook existed and kept unchanged after it.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BnUpdateEditor } from "../components/editors/bnUpdateEditor";
import { BnUpdateTaskCommentEditor } from "../components/editors/bnUpdateTaskCommentEditor";
import { BnUpdateThreadEditor } from "../components/editors/bnUpdateThreadEditor";
import { emitTaskTouched } from "../features/tasks/services/taskEvents";
import { channelService } from "../services/channel/channelService";
import { notifyActionError } from "../services/requestErrorNotifier";
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

const stored = (text: string) => [para(text, "blk-1"), para("", "blk-trailing")];
const myself = { userId: "u1", userName: "Me", userEmail: "me@x.io" } as any;
const baseProps = {
    useTEM: { teamMembers: [], teamMemberProfiles: [] },
    myself,
    setMyself: vi.fn(),
    useUISM: {},
    useCM: { isSubChatVisible: false },
    isInEdit: true,
    numEditorLines: 1,
};

const setIsInEdit = vi.fn();
const setNumEditorLines = vi.fn();
const setTaskCommentLines = vi.fn();
const setIsTaskCommentUpdated = vi.fn();
const emit = vi.fn();
let edit: ReturnType<typeof vi.spyOn>;

const save = () => screen.getByText("Save").closest("button") as HTMLButtonElement;
const cancel = () => screen.getByText("Cancel").closest("button") as HTMLButtonElement;

beforeEach(() => {
    harness.reset();
    vi.clearAllMocks();
    edit = vi.spyOn(channelService, "edit").mockResolvedValue({ id: "m" } as any);
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// Stable objects: the editors re-seed on `message` identity, so a fresh literal per render would
// re-seed on every rerender.
const chatMessage = { content: stored("original"), messageIdWithChatId: "chat-a:7" } as any;
const threadMessage = {
    content: stored("original"),
    chatId: "chat-a",
    messageIdWithChatIdAndThreadId: "chat-a:t-1:7",
} as any;
const targetComment = { commentId: 5, commentBody: stored("original") } as any;

const chatEdit = (over: Record<string, unknown> = {}) => (
    <BnUpdateEditor
        {...(baseProps as any)}
        chat={{ chatId: "chat-a" } as any}
        message={chatMessage}
        setIsInEdit={setIsInEdit}
        setNumEditorLines={setNumEditorLines}
        socket={null}
        {...(over as any)}
    />
);
const threadEdit = (over: Record<string, unknown> = {}) => (
    <BnUpdateThreadEditor
        {...(baseProps as any)}
        message={threadMessage}
        setCurrentChat={vi.fn()}
        setIsInEdit={setIsInEdit}
        setNumEditorLines={setNumEditorLines}
        socket={null}
        thread={{ chatId: "chat-a", threadId: "t-1" } as any}
        {...(over as any)}
    />
);
const commentEdit = (over: Record<string, unknown> = {}) => (
    <BnUpdateTaskCommentEditor
        {...(baseProps as any)}
        isPrivate={true}
        projectId={7}
        projectName="Proj"
        setIsInEdit={setIsInEdit}
        setTaskCommentLines={setTaskCommentLines}
        socket={{ emit } as any}
        targetComment={targetComment}
        taskCommentLines={0}
        taskDisplayId="PRJ-42"
        taskId={42}
        useTM={{ setIsTaskCommentUpdated } as any}
        {...(over as any)}
    />
);

describe.each([
    {
        name: "BnUpdateEditor",
        ui: chatEdit,
        messageId: "chat-a:7",
        channelId: "chat-a",
        hasUploads: true,
    },
    {
        name: "BnUpdateThreadEditor",
        ui: threadEdit,
        messageId: "chat-a:t-1:7",
        channelId: "chat-a",
        hasUploads: true,
    },
])("$name (message edit)", ({ ui, messageId, channelId, name }) => {
    it("opens with the stored text (without its trailing blank line) and Save enabled", () => {
        render(ui());
        expect(lastEditor().document).toHaveLength(1);
        expect(lastEditor().document[0].content[0].text).toBe("original");
        expect(save().disabled).toBe(false);
    });

    it("starts with Save disabled when the stored body has nothing to send", () => {
        render(
            ui({
                message: {
                    content: [para("")],
                    messageIdWithChatId: "x",
                    messageIdWithChatIdAndThreadId: "x",
                },
            })
        );
        expect(save().disabled).toBe(true);
    });

    it("Save edits through channelService.edit with a trailing blank and closes the editor", async () => {
        render(ui());
        typeInto("edited");
        fireEvent.click(save());
        // The document is read synchronously: the editor is torn down by the next line.
        expect(edit).toHaveBeenCalledTimes(1);
        const [id, body, firstLine] = edit.mock.calls[0] as any[];
        expect(id).toBe(messageId);
        expect(body).toHaveLength(2);
        expect(body[0].content[0].text).toBe("edited");
        expect(body[1].content).toEqual([]);
        expect(firstLine).toBe("edited");
        expect(setIsInEdit).toHaveBeenCalledWith(false);
        await flush();
    });

    it("the chord saves and closes too; plain Enter does neither", async () => {
        render(ui());
        typeInto("edited");
        await pressChord({ key: "Enter" });
        expect(edit).not.toHaveBeenCalled();
        expect(setIsInEdit).not.toHaveBeenCalled();
        await pressChord({ ctrlKey: true });
        expect(edit).toHaveBeenCalledTimes(1);
        expect(setIsInEdit).toHaveBeenCalledWith(false);
    });

    it("Cancel closes without saving", () => {
        render(ui());
        typeInto("edited");
        fireEvent.click(cancel());
        expect(edit).not.toHaveBeenCalled();
        expect(setIsInEdit).toHaveBeenCalledWith(false);
    });

    it("an emptied editor saves nothing but still closes", async () => {
        render(ui());
        typeInto("");
        await pressChord({ metaKey: true });
        expect(edit).not.toHaveBeenCalled();
        expect(setIsInEdit).toHaveBeenCalledWith(false);
    });

    it("a message without a v3 id saves nothing but still closes", async () => {
        render(
            ui({
                message: { content: stored("original") },
            })
        );
        await pressChord({ metaKey: true });
        expect(edit).not.toHaveBeenCalled();
        expect(setIsInEdit).toHaveBeenCalledWith(false);
    });

    it("a failed save is toasted and logged, and the editor is closed all the same", async () => {
        edit.mockRejectedValue(new Error("nope"));
        render(ui());
        await pressChord({ metaKey: true });
        await flush();
        expect(notifyActionError).toHaveBeenCalledTimes(1);
        expect(setIsInEdit).toHaveBeenCalledWith(false);
    });

    it("Save follows what is typed", () => {
        render(ui());
        typeInto("");
        expect(save().disabled).toBe(true);
        typeInto("x");
        expect(save().disabled).toBe(false);
    });

    it("reports the line count to the parent on change", () => {
        render(ui());
        typeInto("x");
        expect(setNumEditorLines).toHaveBeenLastCalledWith(2);
    });

    it("re-seeds the editor when the message changes", () => {
        const view = render(ui());
        typeInto("half-typed");
        view.rerender(
            ui({
                message: {
                    content: stored("server version"),
                    chatId: "chat-a",
                    messageIdWithChatId: "chat-a:7",
                    messageIdWithChatIdAndThreadId: "chat-a:t-1:7",
                },
            })
        );
        expect(lastEditor().document[0].content[0].text).toBe("server version");
    });

    it("empties the editor when edit mode ends", () => {
        const view = render(ui());
        view.rerender(ui({ isInEdit: false }));
        expect(lastEditor().document[0].content).toEqual([]);
    });

    it("has no draft: typing writes nothing to storage", () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const setItem = vi.spyOn(Storage.prototype, "setItem");
        render(ui());
        typeInto("edited", 1);
        act(() => vi.advanceTimersByTime(1000));
        expect(setItem).not.toHaveBeenCalled();
        vi.useRealTimers();
    });

    describe("uploads", () => {
        it(`give BlockNote an uploader for ${name}'s channel with the badge and size guard`, async () => {
            const uploadInline = vi
                .spyOn(channelService, "uploadInlineFile")
                .mockResolvedValue("https://media/a.png");
            render(ui());
            let uploading!: Promise<string>;
            act(() => {
                uploading = lastEditor().options.uploadFile(
                    new File(["x"], "a.png", { type: "image/png" })
                );
            });
            expect(screen.getByTestId("badge").getAttribute("data-count")).toBe("1");
            await act(async () => {
                await uploading;
            });
            expect(uploadInline).toHaveBeenCalledWith(channelId, expect.any(File));
            expect(screen.getByTestId("badge").getAttribute("data-count")).toBe("0");
        });

        // MIP-1224: this used to pin "do NOT hold Save while an inline upload is in flight (no gate
        // in edit mode)": an image still uploading has an empty url, so saving stored a broken
        // attachment. Save and the chord now wait, and the host does not close over the upload.
        it("holds Save while an inline upload is in flight, then saves once it lands", async () => {
            let release!: (u: string) => void;
            vi.spyOn(channelService, "uploadInlineFile").mockReturnValue(
                new Promise<string>((resolve) => {
                    release = resolve;
                })
            );
            render(ui());
            let uploading!: Promise<string>;
            act(() => {
                uploading = lastEditor().options.uploadFile(
                    new File(["x"], "a.png", { type: "image/png" })
                );
            });
            await pressChord({ metaKey: true });
            expect(edit).not.toHaveBeenCalled();
            await act(async () => {
                release("u");
                await uploading;
            });
            await pressChord({ metaKey: true });
            expect(edit).toHaveBeenCalledTimes(1);
        });

        it("offer no mobile attach picker and no drop overlay", () => {
            const view = render(ui());
            expect(harness.toolbar?.onAttach).toBeUndefined();
            expect(view.container.querySelector('input[type="file"]')).toBeNull();
            expect(screen.queryByTestId("overlay")).toBeNull();
        });
    });
});

describe("BnUpdateTaskCommentEditor (comment edit)", () => {
    it("opens with the stored comment and Save enabled", () => {
        render(commentEdit());
        expect(lastEditor().document[0].content[0].text).toBe("original");
        expect(save().disabled).toBe(false);
    });

    it("Save emits the task_comment PUT with a trailing blank, then closes", () => {
        render(commentEdit());
        typeInto("edited");
        fireEvent.click(save());
        expect(emit).toHaveBeenCalledTimes(1);
        const [event, payload] = emit.mock.calls[0];
        expect(event).toBe("task_comment");
        expect(payload).toMatchObject({
            method_type: "PUT",
            project_id: 7,
            project_name: "Proj",
            task_id: 42,
            display_id: "PRJ-42",
            comment_id: 5,
            is_private: true,
        });
        expect(payload.comment_body).toHaveLength(2);
        expect(payload.comment_body[0].content[0].text).toBe("edited");
        expect(payload.comment_body[1].content).toEqual([]);
        expect(setIsInEdit).toHaveBeenCalledWith(false);
    });

    it("on ack: refetch signal plus task-touched", () => {
        render(commentEdit());
        fireEvent.click(save());
        emit.mock.calls[0][2]({});
        expect(setIsTaskCommentUpdated).toHaveBeenCalledWith({
            isUpdate: true,
            scrollToBottom: true,
        });
        expect(emitTaskTouched).toHaveBeenCalledWith(42, "comment");
    });

    it("the chord saves; plain Enter does not", async () => {
        render(commentEdit());
        await pressChord({ key: "Enter" });
        expect(emit).not.toHaveBeenCalled();
        await pressChord({ metaKey: true });
        expect(emit).toHaveBeenCalledTimes(1);
        expect(setIsInEdit).toHaveBeenCalledWith(false);
    });

    it("Cancel closes without emitting", () => {
        render(commentEdit());
        fireEvent.click(cancel());
        expect(emit).not.toHaveBeenCalled();
        expect(setIsInEdit).toHaveBeenCalledWith(false);
    });

    it("without a socket, or with an emptied editor, nothing is emitted but it still closes", async () => {
        const view = render(commentEdit({ socket: null }));
        await pressChord({ metaKey: true });
        expect(emit).not.toHaveBeenCalled();
        expect(setIsInEdit).toHaveBeenCalledWith(false);
        view.unmount();
        harness.reset();
        render(commentEdit());
        typeInto("");
        await pressChord({ metaKey: true });
        expect(emit).not.toHaveBeenCalled();
    });

    it("mirrors the line count up (initial and on change)", () => {
        render(commentEdit());
        expect(setTaskCommentLines).toHaveBeenCalledWith(2);
        typeInto("a", 2); // three blocks + one line of text
        expect(setTaskCommentLines).toHaveBeenLastCalledWith(4);
    });

    it("empties the editor when edit mode ends or the task changes", () => {
        const view = render(commentEdit());
        view.rerender(commentEdit({ isInEdit: false }));
        expect(lastEditor().document[0].content).toEqual([]);
    });

    it("has no uploader, no attach picker, no badge, no draft", () => {
        const view = render(commentEdit());
        expect(lastEditor().options.uploadFile).toBeUndefined();
        expect(harness.toolbar?.onAttach).toBeUndefined();
        expect(view.container.querySelector('input[type="file"]')).toBeNull();
        expect(screen.queryByTestId("badge")).toBeNull();
    });
});
