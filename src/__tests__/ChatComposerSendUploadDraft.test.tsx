/**
 * Characterization of the chat and thread composers' send / upload / draft logic (MIP-1161).
 *
 * Written against the code BEFORE the shared hook existed and kept unchanged after it, so the
 * extraction is checked against behavior, not against itself. The BlockNote seam is described in
 * `helpers_composerHarness.tsx`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BnChatEditor } from "../components/editors/bnChatEditor";
import { BnThreadEditor } from "../components/editors/bnThreadEditor";
import { sendChatMessage } from "../features/chat/services/sendChatMessage";
import { channelService } from "../services/channel/channelService";
import { emitRequestError } from "../services/requestErrorNotifier";
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
vi.mock("../features/chat/services/sendChatMessage", () => ({ sendChatMessage: vi.fn() }));
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

const image = (name = "a.png", size = 10) => {
    const file = new File(["x"], name, { type: "image/png" });
    Object.defineProperty(file, "size", { value: size });
    return file;
};
const doc = (name = "report.pdf", size = 10) => {
    const file = new File(["x"], name, { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: size });
    return file;
};

const deferred = <T,>() => {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const myself = { userId: "u1", userName: "Me", userEmail: "me@x.io", avatarImgPath: "" } as any;
const useTEM = { teamMembers: [], teamMemberProfiles: [] } as any;
const useCM = { isSubChatVisible: false } as any;
const socket = { emit: vi.fn() } as any;
const chatA = { chatId: "chat-a", chatType: 1 } as any;
const chatB = { chatId: "chat-b", chatType: 1 } as any;
const threadA = { chatId: "chat-a", chatType: 1, threadId: "t-1" } as any;
const threadB = { chatId: "chat-a", chatType: 1, threadId: "t-2" } as any;

let uploadInline: ReturnType<typeof vi.spyOn>;
let send: ReturnType<typeof vi.spyOn>;
const setNumEditorLines = vi.fn();
const clearPendingFiles = vi.fn();

const chatProps = (over: Record<string, unknown> = {}) =>
    ({
        myself,
        setMyself: vi.fn(),
        socket,
        useTEM,
        useCM,
        chat: chatA,
        setCurrentChat: vi.fn(),
        useUISM: {},
        numEditorLines: 1,
        setNumEditorLines,
        clearPendingFiles,
        ...over,
    }) as any;

const threadProps = (over: Record<string, unknown> = {}) =>
    ({
        myself,
        setMyself: vi.fn(),
        socket,
        useTEM,
        useCM,
        thread: threadA,
        setCurrentThreadChat: vi.fn(),
        setCurrentChat: vi.fn(),
        useUISM: {},
        numEditorLines: 1,
        setNumEditorLines,
        clearPendingFiles,
        ...over,
    }) as any;

beforeEach(() => {
    harness.reset();
    localStorage.clear();
    vi.clearAllMocks();
    uploadInline = vi
        .spyOn(channelService, "uploadInlineFile")
        .mockImplementation(async (_c: string, f: File) => `https://media/${f.name}`);
    send = vi.spyOn(channelService, "send").mockResolvedValue({ id: "m-1" } as any);
    vi.mocked(sendChatMessage).mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const sendButton = () => screen.getByTestId("send") as HTMLButtonElement;
const overlay = () => screen.getByTestId("overlay");
const badge = () => screen.getByTestId("badge");
const blocksOf = (editor = lastEditor()) => editor.document;

describe.each([
    {
        name: "BnChatEditor",
        mount: (over: Record<string, unknown> = {}) =>
            render(<BnChatEditor {...chatProps(over)} />),
        remount: (view: ReturnType<typeof render>, over: Record<string, unknown>) =>
            view.rerender(<BnChatEditor {...chatProps(over)} />),
        otherTarget: { chat: chatB },
        key: "chat:1:chat-a",
        otherKey: "chat:1:chat-b",
        channelId: "chat-a",
    },
    {
        name: "BnThreadEditor",
        mount: (over: Record<string, unknown> = {}) =>
            render(<BnThreadEditor {...threadProps(over)} />),
        remount: (view: ReturnType<typeof render>, over: Record<string, unknown>) =>
            view.rerender(<BnThreadEditor {...threadProps(over)} />),
        otherTarget: { thread: threadB },
        key: "thread:1:chat-a:t-1",
        otherKey: "thread:1:chat-a:t-2",
        channelId: "chat-a",
    },
])(
    "$name (channel composer)",
    ({ mount, remount, otherTarget, key, otherKey, channelId, name }) => {
        const isChat = name === "BnChatEditor";

        describe("typing and the Send button", () => {
            it("enables Send only once there is something to send", () => {
                mount();
                expect(sendButton().disabled).toBe(true);
                typeInto("hi");
                expect(sendButton().disabled).toBe(false);
                typeInto("   ");
                expect(sendButton().disabled).toBe(true);
            });

            it("reports the line count to the parent on every change", () => {
                mount();
                typeInto("hi");
                // 1 block + 1 line of text
                expect(setNumEditorLines).toHaveBeenLastCalledWith(2);
            });
        });

        describe("Cmd/Ctrl+Enter", () => {
            it("sends on Cmd+Enter and on Ctrl+Enter, not on plain Enter", async () => {
                mount();
                typeInto("hello");
                await pressChord({ key: "Enter" });
                await flush();
                expect(isChat ? sendChatMessage : send).not.toHaveBeenCalled();

                await pressChord({ metaKey: true });
                await flush();
                expect(isChat ? sendChatMessage : send).toHaveBeenCalledTimes(1);

                typeInto("again");
                await pressChord({ ctrlKey: true });
                await flush();
                expect(isChat ? sendChatMessage : send).toHaveBeenCalledTimes(2);
            });

            it("does nothing for an empty composer", async () => {
                mount();
                await pressChord({ metaKey: true });
                await flush();
                expect(sendChatMessage).not.toHaveBeenCalled();
                expect(send).not.toHaveBeenCalled();
            });
        });

        describe("send flow", () => {
            it("stores the body with a trailing blank line and clears the composer BEFORE the server answers", async () => {
                const pending = deferred<any>();
                if (isChat) vi.mocked(sendChatMessage).mockReturnValue(pending.promise);
                else send.mockReturnValue(pending.promise);
                mount();
                typeInto("hello");
                const typedId = lastEditor().document[0].id;
                await pressChord({ metaKey: true });

                // The request is in flight and the composer is already empty and disabled.
                expect(lastEditor().document).toHaveLength(1);
                expect(lastEditor().document[0].content).toEqual([]);
                expect(sendButton().disabled).toBe(true);

                const body: any[] = isChat
                    ? vi.mocked(sendChatMessage).mock.calls[0][0].content
                    : (send.mock.calls[0][1] as any[]);
                expect(body).toHaveLength(2);
                expect(body[0].id).toBe(typedId);
                expect(body[0].content[0].text).toBe("hello");
                expect(body[1].content).toEqual([]);

                pending.resolve(isChat ? true : { id: "m" });
                await flush();
            });

            if (isChat) {
                it("hands sendChatMessage the chat, the user and the socket", async () => {
                    mount();
                    typeInto("hello");
                    await pressChord({ metaKey: true });
                    await flush();
                    const arg = vi.mocked(sendChatMessage).mock.calls[0][0];
                    expect(arg.chat).toBe(chatA);
                    expect(arg.myself).toBe(myself);
                    expect(arg.socket).toBe(socket);
                });

                it("does not send without a socket", async () => {
                    mount({ socket: null });
                    typeInto("hello");
                    await pressChord({ metaKey: true });
                    await flush();
                    expect(sendChatMessage).not.toHaveBeenCalled();
                    // ... and keeps the text.
                    expect(lastEditor().document[0].content[0].text).toBe("hello");
                });
            } else {
                it("posts a thread reply under the thread root with the first line and an echo row", async () => {
                    mount();
                    typeInto("hello");
                    await pressChord({ metaKey: true });
                    await flush();
                    const [channelUuid, , opts] = send.mock.calls[0] as any[];
                    expect(channelUuid).toBe("chat-a");
                    expect(opts.parentId).toBe("t-1");
                    expect(opts.bodyText).toBe("hello");
                    expect(opts.echo.sender).toEqual({
                        avatarImgPath: null,
                        isSystemUser: false,
                        userEmail: "me@x.io",
                        userId: "u1",
                        userName: "Me",
                    });
                });

                it("sends without a socket (v3 path needs none)", async () => {
                    mount({ socket: null });
                    typeInto("hello");
                    await pressChord({ metaKey: true });
                    await flush();
                    expect(send).toHaveBeenCalledTimes(1);
                });

                it("toasts a failure", async () => {
                    send.mockRejectedValue(new Error("nope"));
                    mount();
                    typeInto("hello");
                    await pressChord({ metaKey: true });
                    await flush();
                    expect(emitRequestError).toHaveBeenCalledWith("messageSendFailed");
                });
            }

            const fail = () => {
                if (isChat) vi.mocked(sendChatMessage).mockResolvedValue(false);
                else send.mockRejectedValue(new Error("nope"));
            };

            it("puts the text back (a deep clone) when the send fails and the composer is still empty", async () => {
                fail();
                mount();
                typeInto("hello");
                const original = lastEditor().document;
                await pressChord({ metaKey: true });
                await flush();
                const restored = lastEditor().document;
                expect(restored).toEqual(original);
                expect(restored).not.toBe(original);
                expect(restored[0]).not.toBe(original[0]);
                expect(sendButton().disabled).toBe(false);
            });

            it("does NOT overwrite a message the user started meanwhile when the send fails", async () => {
                const pending = deferred<any>();
                if (isChat) vi.mocked(sendChatMessage).mockReturnValue(pending.promise);
                else send.mockReturnValue(pending.promise);
                mount();
                typeInto("first");
                await pressChord({ metaKey: true });
                typeInto("second");
                if (isChat) pending.resolve(false);
                else pending.reject(new Error("nope"));
                await flush();
                expect(lastEditor().document[0].content[0].text).toBe("second");
            });

            it("does not restore after a successful send", async () => {
                mount();
                typeInto("hello");
                await pressChord({ metaKey: true });
                await flush();
                expect(lastEditor().document[0].content).toEqual([]);
            });
        });

        describe("upload gate", () => {
            it("holds Send and the chord while an inline upload is in flight, then releases them", async () => {
                const pending = deferred<string>();
                uploadInline.mockReturnValue(pending.promise);
                mount();
                typeInto("hello");
                expect(sendButton().disabled).toBe(false);

                let uploading!: Promise<string>;
                act(() => {
                    // What BlockNote calls for a paste / drop / slash insert.
                    uploading = lastEditor().options.uploadFile(image());
                });
                expect(badge().getAttribute("data-count")).toBe("1");
                expect(sendButton().disabled).toBe(true);

                await pressChord({ metaKey: true });
                await flush();
                expect(sendChatMessage).not.toHaveBeenCalled();
                expect(send).not.toHaveBeenCalled();

                await act(async () => {
                    pending.resolve("https://media/a.png");
                    await uploading;
                });
                expect(badge().getAttribute("data-count")).toBe("0");
                expect(sendButton().disabled).toBe(false);
            });

            it("counts the badge down even when the upload fails", async () => {
                uploadInline.mockRejectedValue(new Error("boom"));
                mount();
                await act(async () => {
                    await lastEditor()
                        .options.uploadFile(image())
                        .catch(() => {});
                });
                expect(badge().getAttribute("data-count")).toBe("0");
            });
        });

        describe("files dropped on the pane (pendingFiles)", () => {
            it("uploads in series, inserts an image or file block each, shows progress, then clears the queue", async () => {
                const first = deferred<string>();
                const second = deferred<string>();
                uploadInline
                    .mockReturnValueOnce(first.promise)
                    .mockReturnValueOnce(second.promise);
                const view = mount();
                const files = [image("a.png"), doc("b.pdf")];
                await act(async () => remount(view, { pendingFiles: files }));

                expect(overlay().getAttribute("data-open")).toBe("true");
                expect(overlay().getAttribute("data-detail")).toBe("a.png (1 / 2)");
                expect(uploadInline).toHaveBeenCalledTimes(1);
                expect(uploadInline.mock.calls[0][0]).toBe(channelId);
                expect(sendButton().disabled).toBe(true);
                expect(clearPendingFiles).not.toHaveBeenCalled();

                await act(async () => first.resolve("https://media/a.png"));
                await flush();
                expect(overlay().getAttribute("data-detail")).toBe("b.pdf (2 / 2)");

                await act(async () => second.resolve("https://media/b.pdf"));
                await flush();

                const blocks = blocksOf();
                expect(blocks.find((b: any) => b.type === "image")?.props).toEqual({
                    url: "https://media/a.png",
                    name: "a.png",
                });
                expect(blocks.find((b: any) => b.type === "file")?.props).toEqual({
                    url: "https://media/b.pdf",
                    name: "b.pdf",
                });
                expect(overlay().getAttribute("data-open")).toBe("false");
                expect(clearPendingFiles).toHaveBeenCalledTimes(1);
            });

            it("keeps the queue populated until the loop ends, so a remount mid-upload re-runs it (documented quirk)", async () => {
                const first = deferred<string>();
                uploadInline.mockReturnValueOnce(first.promise);
                const files = [image("a.png")];
                const view = mount();
                await act(async () => remount(view, { pendingFiles: files }));
                expect(clearPendingFiles).not.toHaveBeenCalled();
                view.unmount();
                // the pane swaps the composer for the edit one and back: a fresh mount sees the
                // same, still-uncleared array and uploads the file a second time
                mount({ pendingFiles: files });
                await flush();
                expect(uploadInline).toHaveBeenCalledTimes(2);
                await act(async () => first.resolve("u"));
            });

            it("skips a file that fails and keeps going", async () => {
                uploadInline.mockRejectedValueOnce(new Error("boom"));
                const view = mount();
                await act(async () =>
                    remount(view, { pendingFiles: [image("bad.png"), doc("ok.pdf")] })
                );
                await flush();
                const blocks = blocksOf();
                expect(blocks.some((b: any) => b.props?.name === "bad.png")).toBe(false);
                expect(blocks.some((b: any) => b.props?.name === "ok.pdf")).toBe(true);
                expect(overlay().getAttribute("data-open")).toBe("false");
                expect(clearPendingFiles).toHaveBeenCalledTimes(1);
            });

            it("drops oversize files up front and uploads only the rest", async () => {
                const view = mount();
                await flush(); // the tier limit (1024 bytes here) resolves
                await act(async () =>
                    remount(view, { pendingFiles: [doc("huge.pdf", 5000), doc("small.pdf", 10)] })
                );
                await flush();
                expect(uploadInline).toHaveBeenCalledTimes(1);
                expect((uploadInline.mock.calls[0][1] as File).name).toBe("small.pdf");
                expect(overlay().getAttribute("data-detail")).toBe("");
            });

            it("ignores an empty queue and a missing clear callback", async () => {
                const view = mount();
                await act(async () => remount(view, { pendingFiles: [] }));
                await act(async () =>
                    remount(view, { pendingFiles: [image()], clearPendingFiles: undefined })
                );
                await flush();
                expect(uploadInline).not.toHaveBeenCalled();
            });
        });

        describe("mobile attach picker", () => {
            it("is always offered and uploads what the native picker returns", async () => {
                const view = mount();
                expect(harness.toolbar?.onAttach).toBeTypeOf("function");
                const input = view.container.querySelector(
                    'input[type="file"]'
                ) as HTMLInputElement;
                expect(input.multiple).toBe(true);
                await act(async () => {
                    fireEvent.change(input, { target: { files: [image("p.png")] } });
                });
                await flush();
                expect(uploadInline).toHaveBeenCalledWith(channelId, expect.any(File));
                expect(blocksOf().some((b: any) => b.props?.name === "p.png")).toBe(true);
                // the picker value is reset so re-picking the same file fires again
                expect(input.value).toBe("");
            });

            it("ignores an empty selection", async () => {
                const view = mount();
                const input = view.container.querySelector(
                    'input[type="file"]'
                ) as HTMLInputElement;
                await act(async () => {
                    fireEvent.change(input, { target: { files: [] } });
                });
                expect(uploadInline).not.toHaveBeenCalled();
            });
        });

        describe("drafts", () => {
            beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));

            it("persists typing after a 400 ms pause, not before", () => {
                mount();
                typeInto("hello", 1);
                act(() => vi.advanceTimersByTime(399));
                expect(readStoredDraft(key)).toBeNull();
                act(() => vi.advanceTimersByTime(1));
                expect(readStoredDraft(key)[0].content[0].text).toBe("hello");
            });

            it("a burst of typing writes once, with the last content", () => {
                const setItem = vi.spyOn(Storage.prototype, "setItem");
                mount();
                typeInto("h", 1);
                act(() => vi.advanceTimersByTime(100));
                typeInto("he", 1);
                act(() => vi.advanceTimersByTime(100));
                typeInto("hel", 1);
                act(() => vi.advanceTimersByTime(400));
                const writes = setItem.mock.calls.filter(([k]) => String(k).includes(key));
                expect(writes).toHaveLength(1);
                expect(readStoredDraft(key)[0].content[0].text).toBe("hel");
            });

            // MIP-1222: this used to PIN the bug ("a one-block document is empty"). Since BlockNote
            // 0.57 one typed line is one block, so a one-line draft was never saved and was lost on
            // a chat switch or a reload.
            it("persists a one-line draft: a single block with text is a draft", () => {
                mount();
                typeInto("hello");
                act(() => vi.advanceTimersByTime(800));
                expect(readStoredDraft(key)[0].content[0].text).toBe("hello");
            });

            it("does not persist an empty document (spaces only)", () => {
                mount();
                typeInto("hello");
                act(() => vi.advanceTimersByTime(800));
                typeInto("   ");
                act(() => vi.advanceTimersByTime(800));
                expect(readStoredDraft(key)).toBeNull();
            });

            it("restores the stored draft on mount and wipes the composer when there is none", () => {
                localStorage.setItem(draftKey(key), JSON.stringify([para("old draft"), para("")]));
                mount();
                expect(lastEditor().document[0].content[0].text).toBe("old draft");
            });

            it("keeps a separate draft per target and swaps it when the target changes", () => {
                const view = mount();
                typeInto("for A", 1);
                act(() => vi.advanceTimersByTime(400));
                remount(view, otherTarget);
                // B has no draft: composer wiped; A's draft untouched
                expect(lastEditor().document[0].content).toEqual([]);
                expect(readStoredDraft(key)[0].content[0].text).toBe("for A");

                typeInto("for B", 1);
                act(() => vi.advanceTimersByTime(400));
                expect(readStoredDraft(otherKey)[0].content[0].text).toBe("for B");

                remount(view, {});
                expect(lastEditor().document[0].content[0].text).toBe("for A");
            });

            it("does not write the old target's text into the new target's key when switching mid-debounce", () => {
                const view = mount();
                typeInto("for A", 1);
                remount(view, otherTarget); // before the 400 ms elapsed
                act(() => vi.advanceTimersByTime(800));
                expect(readStoredDraft(otherKey)).toBeNull();
            });

            it("removes the key when the composer is emptied", () => {
                mount();
                typeInto("hello", 1);
                act(() => vi.advanceTimersByTime(400));
                expect(readStoredDraft(key)).not.toBeNull();
                typeInto("");
                act(() => vi.advanceTimersByTime(400));
                expect(readStoredDraft(key)).toBeNull();
            });

            it("a send clears the stored draft at once and cancels the pending save", async () => {
                mount();
                typeInto("hello", 1);
                act(() => vi.advanceTimersByTime(400));
                expect(readStoredDraft(key)).not.toBeNull();
                typeInto("hello again", 1);
                await pressChord({ metaKey: true });
                expect(readStoredDraft(key)).toBeNull();
                act(() => vi.advanceTimersByTime(800));
                expect(readStoredDraft(key)).toBeNull();
            });
        });

        describe("BlockNote's own inserts", () => {
            it("uses the upload target of the FIRST render (useCreateBlockNote freezes its options)", async () => {
                const view = mount();
                const frozen = lastEditor().options.uploadFile;
                remount(view, otherTarget);
                expect(lastEditor().options.uploadFile).toBe(frozen);
                await act(async () => {
                    await frozen(image());
                });
                expect(uploadInline).toHaveBeenLastCalledWith(channelId, expect.any(File));
            });
        });
    }
);
