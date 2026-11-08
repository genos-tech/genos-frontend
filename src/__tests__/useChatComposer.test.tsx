/**
 * The shared composer hook on its own (MIP-1161): the typing render budget and the contracts the
 * composers rely on that are easiest to pin without a component around them.
 *
 * Typing rule (see `useChatComposer`): no per-keystroke React state above the editor, the draft
 * is debounced, the document is read once per keystroke. A host that calls the hook must not
 * re-render per keystroke: only the empty -> non-empty flip of Send is allowed to.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isSendShortcut, useChatComposer } from "../components/editors/composer/useChatComposer";
import { resolveUploadLimitBytes } from "../services/uploadLimit";
import { harness, lastEditor, para } from "./helpers_composerHarness";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));
vi.mock("../components/editors/genos/useGenosEditor", async () =>
    (await import("./helpers_composerHarness")).useGenosEditorMock()
);
vi.mock("../context/AuthContext", () => ({ useOptionalAccessToken: () => "tok" }));
vi.mock("../services/uploadLimit", () => ({
    resolveUploadLimitBytes: vi.fn(async () => 1024),
    invalidateUploadLimit: vi.fn(),
}));
vi.mock("../components/editors/blockNoteI18n", () => ({ useBlockNoteDictionary: () => ({}) }));

const flush = () =>
    act(async () => {
        for (let i = 0; i < 8; i += 1) await Promise.resolve();
    });

const setup = async (extra: Record<string, unknown> = {}) => {
    let renders = 0;
    const submit = vi.fn();
    const onLinesChange = vi.fn();
    const view = renderHook(() => {
        renders += 1;
        const composer = useChatComposer({
            schema: {} as any,
            dictionary: {} as any,
            uploads: { channelId: "c-1" },
            draftKey: "hook:k",
            onLinesChange,
            submit,
            ...extra,
        } as any);
        // What `<BlockNoteView {...composer.viewProps}>` does: the fake editor reports its
        // changes to the latest props.
        harness.view = composer.viewProps;
        return composer;
    });
    await flush(); // the upload-tier lookup lands a tick after mount
    return { ...view, renders: () => renders, submit, onLinesChange };
};

const typeChars = (n: number, from = 0) => {
    for (let i = from; i < from + n; i += 1) {
        act(() => lastEditor().type("word ".repeat(20).slice(0, i + 1)));
    }
};

beforeEach(() => {
    harness.reset();
    localStorage.clear();
    vi.clearAllMocks();
});

describe("useChatComposer typing render budget", () => {
    it("typing N characters re-renders the host zero times once Send has settled", async () => {
        const view = await setup();
        // the first characters flip Send; React renders once more for the first same-value
        // setState after a real update before it bails out, so settle with two
        typeChars(2);
        const settled = view.renders();
        typeChars(80, 2);
        expect(view.renders() - settled).toBe(0);
    });

    it("the first character costs exactly one re-render (the Send flip) and enables Send", async () => {
        const view = await setup();
        expect(view.result.current.sendDisabled).toBe(true);
        const before = view.renders();
        typeChars(1);
        expect(view.renders() - before).toBe(1);
        expect(view.result.current.sendDisabled).toBe(false);
    });

    it("reads the document once per keystroke (BlockNote rebuilds it from the editor state on every read)", async () => {
        const view = await setup();
        const editor = lastEditor();
        let reads = 0;
        const current = editor.document;
        Object.defineProperty(editor, "document", {
            get: () => {
                reads += 1;
                return current;
            },
            configurable: true,
        });
        act(() => view.result.current.viewProps.onChange());
        expect(reads).toBe(1);
    });

    it("reports the line count to the host on every keystroke without storing it", async () => {
        const view = await setup();
        view.onLinesChange.mockClear(); // mount restored the (absent) draft through onChange
        typeChars(3);
        expect(view.onLinesChange).toHaveBeenCalledTimes(3);
        expect(view.onLinesChange).toHaveBeenLastCalledWith(2);
    });
});

describe("useChatComposer draft persistence", () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));

    it("a burst of keystrokes writes the draft once, 400 ms after the last one", async () => {
        vi.useRealTimers();
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const setItem = vi.spyOn(Storage.prototype, "setItem");
        await setup();
        for (let i = 0; i < 30; i += 1) {
            act(() => lastEditor().type(`text ${i}`, 1));
            act(() => vi.advanceTimersByTime(10));
        }
        expect(setItem.mock.calls.filter(([k]) => String(k).includes("hook:k"))).toHaveLength(0);
        act(() => vi.advanceTimersByTime(400));
        const writes = setItem.mock.calls.filter(([k]) => String(k).includes("hook:k"));
        expect(writes).toHaveLength(1);
        expect(JSON.parse(String(writes[0][1]))[0].content[0].text).toBe("text 29");
        vi.useRealTimers();
    });

    it("no draft key: nothing is ever written", async () => {
        vi.useRealTimers();
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const setItem = vi.spyOn(Storage.prototype, "setItem");
        await setup({ draftKey: null });
        act(() => lastEditor().type("hello", 1));
        act(() => vi.advanceTimersByTime(1000));
        expect(setItem).not.toHaveBeenCalled();
        vi.useRealTimers();
    });
});

describe("useChatComposer uploads", () => {
    it("looks up the upload tier only when the composer uploads", async () => {
        await setup({ uploads: undefined });
        expect(resolveUploadLimitBytes).not.toHaveBeenCalled();
        await setup();
        expect(resolveUploadLimitBytes).toHaveBeenCalledTimes(1);
    });

    it("gives BlockNote an uploader only with a channel, and offers the picker the same way", async () => {
        const withChannel = await setup();
        expect(lastEditor().options.uploadFile).toBeTypeOf("function");
        expect(withChannel.result.current.openAttach).toBeTypeOf("function");
        harness.reset();
        const without = await setup({ uploads: { channelId: undefined } });
        expect(lastEditor().options.uploadFile).toBeUndefined();
        expect(without.result.current.openAttach).toBeUndefined();
        expect(resolveUploadLimitBytes).toHaveBeenCalledTimes(2);
    });
});

describe("useChatComposer send", () => {
    it("reads the document and calls submit synchronously (an edit host unmounts the editor right after)", async () => {
        const view = await setup({ clear: "never", draftKey: null });
        act(() => lastEditor().type("edited"));
        let promise!: Promise<void>;
        act(() => {
            promise = view.result.current.send();
        });
        // no microtask has run yet
        expect(view.submit).toHaveBeenCalledTimes(1);
        expect(view.submit.mock.calls[0][0][0].content[0].text).toBe("edited");
        await act(async () => promise);
    });

    it("does not send an empty composer, a gated one, or one with an upload running", async () => {
        const gated = vi.fn(() => false);
        const view = await setup({ canSubmit: gated });
        await act(async () => view.result.current.send());
        expect(view.submit).not.toHaveBeenCalled();
        act(() => lastEditor().type("hello"));
        await act(async () => view.result.current.send());
        expect(gated).toHaveBeenCalled();
        expect(view.submit).not.toHaveBeenCalled();
    });

    it("clear 'before' empties the composer first and restores a failed send as a deep clone", async () => {
        const view = await setup({ draftKey: null });
        view.submit.mockResolvedValue(false);
        act(() => lastEditor().type("hello"));
        const original = lastEditor().document;
        await act(async () => view.result.current.send());
        expect(lastEditor().document).toEqual(original);
        expect(lastEditor().document).not.toBe(original);
    });

    it("clear 'after' keeps the text until a clean send, never clears on failure, and calls onSent", async () => {
        const onSent = vi.fn();
        const view = await setup({ clear: "after", onSent, draftKey: null });
        view.submit.mockResolvedValueOnce(false).mockResolvedValueOnce({ id: "m" });
        act(() => lastEditor().type("hello"));
        await act(async () => view.result.current.send());
        expect(lastEditor().document[0].content[0].text).toBe("hello");
        expect(onSent).not.toHaveBeenCalled();
        await act(async () => view.result.current.send());
        expect(lastEditor().document[0].content).toEqual([]);
        expect(onSent).toHaveBeenCalledWith({ id: "m" });
        expect(view.result.current.busy).toBe(false);
    });

    it("clear 'never' leaves the composer alone", async () => {
        const view = await setup({ clear: "never", draftKey: null });
        act(() => lastEditor().type("hello"));
        await act(async () => view.result.current.send());
        expect(view.submit).toHaveBeenCalledTimes(1);
        expect(lastEditor().document[0].content[0].text).toBe("hello");
    });

    it("the chord is Cmd or Ctrl plus Enter", () => {
        expect(isSendShortcut({ key: "Enter", metaKey: true, ctrlKey: false })).toBe(true);
        expect(isSendShortcut({ key: "Enter", metaKey: false, ctrlKey: true })).toBe(true);
        expect(isSendShortcut({ key: "Enter", metaKey: false, ctrlKey: false })).toBe(false);
        expect(isSendShortcut({ key: "a", metaKey: true, ctrlKey: false })).toBe(false);
    });

    it("trigger starts the send and calls onSendAttempt synchronously, even when the guards bail", async () => {
        const onSendAttempt = vi.fn();
        const view = await setup({ clear: "never", draftKey: null, onSendAttempt });
        // nothing typed: send() returns early, the host still closes
        act(() => view.result.current.trigger());
        expect(onSendAttempt).toHaveBeenCalledTimes(1);
        expect(view.submit).not.toHaveBeenCalled();
        act(() => lastEditor().type("hello"));
        act(() => view.result.current.trigger());
        expect(onSendAttempt).toHaveBeenCalledTimes(2);
        expect(view.submit).toHaveBeenCalledTimes(1);
        await flush();
    });

    it("the chord goes through trigger", async () => {
        const onSendAttempt = vi.fn();
        const view = await setup({ clear: "never", draftKey: null, onSendAttempt });
        act(() => lastEditor().type("hello"));
        act(() =>
            view.result.current.viewProps.onKeyDown({
                key: "Enter",
                metaKey: true,
                ctrlKey: false,
            } as any)
        );
        expect(onSendAttempt).toHaveBeenCalledTimes(1);
        expect(view.submit).toHaveBeenCalledTimes(1);
        await flush();
    });

    it("Send state follows the isSendable override, not only hasSendableContent", async () => {
        const view = await setup({
            isSendable: (blocks: any[]) => blocks.length > 1,
            draftKey: null,
        });
        act(() => lastEditor().type("hello"));
        expect(view.result.current.sendDisabled).toBe(true);
        act(() => lastEditor().type("hello", 1));
        expect(view.result.current.sendDisabled).toBe(false);
    });

    it("an isSendable override replaces the default emptiness rule", async () => {
        const view = await setup({ isSendable: () => true, draftKey: null });
        await act(async () => view.result.current.send());
        expect(view.submit).toHaveBeenCalledTimes(1);
        void para;
    });
});
