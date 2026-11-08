/**
 * Characterization of `MessageComposerV3`'s send / draft logic (MIP-1161): the flag-gated v3
 * composer, which differs from the legacy ones on purpose (clear AFTER a clean send, a busy lock,
 * its own staged-attachment strip, its own emptiness rule).
 *
 * Written against the code BEFORE the shared hook existed and kept unchanged after it. The
 * BlockNote seam is described in `helpers_composerHarness.tsx`; the pure adapters and the
 * attachment flows are covered by V3MessageComposer.test.tsx and V3AttachmentUpload.test.tsx.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MessageComposerV3 } from "../features/channel/components/MessageComposerV3";
import { channelService } from "../services/channel/channelService";
import { harness, lastEditor, para, typeInto } from "./helpers_composerHarness";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));
vi.mock("@blocknote/mantine", async () =>
    (await import("./helpers_composerHarness")).blockNoteMantineMock()
);
vi.mock("@blocknote/react", async (original) => ({
    ...(await original<typeof import("@blocknote/react")>()),
    SuggestionMenuController: () => null,
}));
vi.mock("../components/editors/HashMention", async (original) => ({
    ...(await original<typeof import("../components/editors/HashMention")>()),
    HashSuggestionMenuController: () => null,
}));
vi.mock("../components/editors/genos/useGenosEditor", async () =>
    (await import("./helpers_composerHarness")).useGenosEditorMock()
);
vi.mock("../context/AuthContext", () => ({ useOptionalAccessToken: () => "tok" }));
vi.mock("../services/uploadLimit", () => ({
    resolveUploadLimitBytes: vi.fn(async () => 1024 * 1024),
    invalidateUploadLimit: vi.fn(),
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
const deferred = <T,>() => {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const onError = vi.fn();
const onSendComplete = vi.fn();
let send: ReturnType<typeof vi.spyOn>;

const mount = (over: Record<string, unknown> = {}) =>
    render(
        <MessageComposerV3
            channelId="c-1"
            currentUserId="u1"
            onError={onError}
            onSendComplete={onSendComplete}
            {...(over as any)}
        />
    );

/** The chord is handled on the wrapper div around BlockNoteView, not on BlockNoteView. */
const chord = (
    init: { metaKey?: boolean; ctrlKey?: boolean; key?: string } = { metaKey: true }
) => {
    const event = { key: "Enter", ...init };
    const host = screen.getByTestId("message-composer-v3-editor-host");
    let notPrevented = true;
    act(() => {
        notPrevented = fireEvent.keyDown(host, event);
    });
    return { defaultPrevented: !notPrevented };
};
const sendButton = () => screen.getByTestId("message-composer-v3-send") as HTMLButtonElement;

beforeEach(() => {
    harness.reset();
    localStorage.clear();
    vi.clearAllMocks();
    send = vi.spyOn(channelService, "send").mockResolvedValue({ id: "m-1" } as any);
    vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("MessageComposerV3 send", () => {
    it("Cmd/Ctrl+Enter sends the raw document with the derived body text and parent id", async () => {
        mount({ parentId: "root-9" });
        typeInto("hello there");
        const { defaultPrevented } = chord();
        await flush();
        expect(defaultPrevented).toBe(true);
        expect(send).toHaveBeenCalledTimes(1);
        const [channelId, blocks, opts] = send.mock.calls[0] as any[];
        expect(channelId).toBe("c-1");
        // verbatim document: NO trailing blank (unlike the legacy composers)
        expect(blocks).toHaveLength(1);
        expect(blocks[0].content[0].text).toBe("hello there");
        expect(opts).toEqual({ bodyText: "hello there", parentId: "root-9" });
    });

    it("Ctrl+Enter works too, plain Enter does not send and is not swallowed", async () => {
        mount();
        typeInto("hi");
        expect(chord({ key: "Enter" }).defaultPrevented).toBe(false);
        await flush();
        expect(send).not.toHaveBeenCalled();
        chord({ ctrlKey: true });
        await flush();
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("sends nothing for an empty composer", async () => {
        mount();
        chord();
        await flush();
        expect(send).not.toHaveBeenCalled();
    });

    // MIP-1224: a lone space used to count (the v3 composer had its own `hasContent`).
    it("a lone space is not a message", async () => {
        mount();
        typeInto(" ");
        chord();
        await flush();
        expect(send).not.toHaveBeenCalled();
        expect(sendButton().disabled).toBe(true);
    });

    it("typing alone enables Send (its state follows the editor, not just the next render)", async () => {
        mount();
        expect(sendButton().disabled).toBe(true);
        typeInto("hello");
        expect(sendButton().disabled).toBe(false);
        typeInto("");
        expect(sendButton().disabled).toBe(true);
    });

    it("keeps the text while the request is in flight, then clears composer and draft and reports the id", async () => {
        const pending = deferred<any>();
        send.mockReturnValue(pending.promise);
        mount();
        typeInto("hello", 1);
        chord();
        expect(lastEditor().document[0].content[0].text).toBe("hello");
        await act(async () => pending.resolve({ id: "m-77" }));
        await flush();
        expect(lastEditor().document[0].content).toEqual([]);
        expect(readStoredDraft("v3-channel:c-1")).toBeNull();
        expect(onSendComplete).toHaveBeenCalledWith("m-77");
        expect(onError).not.toHaveBeenCalled();
    });

    // MIP-1224: this used to pin the quirk ("a second chord SENDS AGAIN").
    it("a second chord while the first is in flight is ignored (one request at a time)", async () => {
        const pending = deferred<any>();
        send.mockReturnValue(pending.promise);
        mount();
        typeInto("hello");
        chord();
        chord();
        await flush();
        expect(send).toHaveBeenCalledTimes(1);
        await act(async () => pending.resolve({ id: "m" }));
    });

    it("locks the Send and attach buttons while sending", async () => {
        const pending = deferred<any>();
        send.mockReturnValue(pending.promise);
        mount();
        typeInto("hello");
        chord();
        await flush();
        expect(sendButton().disabled).toBe(true);
        expect(
            (screen.getByTestId("message-composer-v3-attach") as HTMLButtonElement).disabled
        ).toBe(true);
        await act(async () => pending.resolve({ id: "m" }));
        await flush();
        expect(
            (screen.getByTestId("message-composer-v3-attach") as HTMLButtonElement).disabled
        ).toBe(false);
    });

    it("on failure keeps the text and reports `CODE: message` through onError", async () => {
        send.mockRejectedValue(Object.assign(new Error("denied"), { code: "FORBIDDEN" }));
        mount();
        typeInto("hello");
        chord();
        await flush();
        expect(onError).toHaveBeenCalledWith("FORBIDDEN: denied");
        expect(lastEditor().document[0].content[0].text).toBe("hello");
        expect(onSendComplete).not.toHaveBeenCalled();
    });

    it("on failure the busy lock is released so the user can retry", async () => {
        send.mockRejectedValueOnce(new Error("blip")).mockResolvedValue({ id: "m" });
        mount();
        typeInto("hello");
        chord();
        await flush();
        chord();
        await flush();
        expect(send).toHaveBeenCalledTimes(2);
    });

    it("a staged attachment alone is sendable; it uploads after the ack against the message id", async () => {
        const upload = vi.spyOn(channelService, "uploadAttachment").mockResolvedValue({
            id: "att-1",
            fileUrl: "u",
            mime: "image/png",
            sizeBytes: 1,
        } as any);
        vi.spyOn(channelService, "handleAttachmentAdded").mockImplementation(() => {});
        const view = mount();
        const input = screen.getByTestId("message-composer-v3-file-input") as HTMLInputElement;
        const file = new File(["x"], "a.png", { type: "image/png" });
        await act(async () => {
            fireEvent.change(input, { target: { files: [file] } });
        });
        await flush();
        expect(
            view.container.querySelector('[data-testid^="message-composer-v3-pending-"]')
        ).not.toBeNull();
        chord();
        await flush();
        expect(send).toHaveBeenCalledTimes(1);
        expect(upload).toHaveBeenCalledWith("m-1", file);
    });

    it("reports a partial attachment failure through onError", async () => {
        vi.spyOn(channelService, "uploadAttachment").mockRejectedValue(new Error("disk full"));
        mount();
        const input = screen.getByTestId("message-composer-v3-file-input") as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, {
                target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
            });
        });
        await flush();
        chord();
        await flush();
        expect(onError).toHaveBeenCalledWith("Uploaded 0, 1 failed: disk full");
    });
});

describe("MessageComposerV3 drafts", () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));

    it("persists under the channel key after 400 ms", () => {
        mount();
        typeInto("hello", 1);
        act(() => vi.advanceTimersByTime(399));
        expect(readStoredDraft("v3-channel:c-1")).toBeNull();
        act(() => vi.advanceTimersByTime(1));
        expect(readStoredDraft("v3-channel:c-1")[0].content[0].text).toBe("hello");
    });

    it("a thread composer keeps its own key", () => {
        mount({ parentId: "root-9" });
        typeInto("hello", 1);
        act(() => vi.advanceTimersByTime(400));
        expect(readStoredDraft("v3-channel:c-1:thread:root-9")).not.toBeNull();
        expect(readStoredDraft("v3-channel:c-1")).toBeNull();
    });

    it("restores the stored draft on mount", () => {
        localStorage.setItem(draftKey("v3-channel:c-1"), JSON.stringify([para("old"), para("")]));
        mount();
        expect(lastEditor().document[0].content[0].text).toBe("old");
    });

    it("swaps drafts when the channel changes", () => {
        const view = mount();
        typeInto("in c-1", 1);
        act(() => vi.advanceTimersByTime(400));
        view.rerender(<MessageComposerV3 channelId="c-2" currentUserId="u1" onError={onError} />);
        expect(lastEditor().document[0].content).toEqual([]);
        view.rerender(<MessageComposerV3 channelId="c-1" currentUserId="u1" onError={onError} />);
        expect(lastEditor().document[0].content[0].text).toBe("in c-1");
    });
});
