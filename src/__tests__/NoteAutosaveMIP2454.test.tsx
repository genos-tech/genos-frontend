/**
 * MIP-2454: a note could keep less than its editor showed. The autosave PUT carries the body as it
 * was when it started; when it came back it cleared the "edited" flag, which cancelled the timer of
 * the words typed meanwhile. The same note could also lose them when a newer save overtook an older
 * one, when a save failed (it was counted as saved), and when the panel closed or showed another
 * note within the debounce.
 *
 * The real hook, `saveNote` and the three PUT services run. The HTTP client answers when the test
 * says so, and the editor is its one contract with the hook: `bodyReadRef` reads its document.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNoteEditorCore } from "../features/notes/common/hooks/useNoteEditorCore";
import {
    readUnsavedNoteBody,
    UNSAVED_NOTE_BODY_PREFIX,
} from "../features/notes/common/services/unsavedNoteBody";
import { useChatPanelNote } from "../hooks/notes/useChatPanelNote";
import { clearNoteCache, getCachedNote } from "../hooks/notes/useNoteData";
import { subscribeRequestErrors } from "../services/requestErrorNotifier";
import type { ChatNoteProps, MyNoteProps } from "../types/notes";
import { clearSignOutLocalStorage } from "../utils/signOutLeftovers";

type Put = {
    noteId: number;
    title: string;
    text: string;
    ok: () => void;
    fail: (status?: number) => void;
};
const net = vi.hoisted(() => ({
    puts: [] as Put[],
    // What `GET .../single/` answers with: the server's own copy.
    stored: "Start.",
    gets: 0,
}));

vi.mock("../services/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/api")>()),
    authApi: () => ({
        get: async (url: string) => {
            net.gets += 1;
            const noteId = Number(/note_id=(\d+)/.exec(url)?.[1]);
            return {
                data: {
                    noteType: 1,
                    noteId,
                    title: "Server title",
                    body: [{ type: "paragraph", text: net.stored }],
                },
            };
        },
        put: (_url: string, data: { note_id: number; title: string; body: { text: string }[] }) =>
            new Promise((resolve, reject) => {
                net.puts.push({
                    noteId: data.note_id,
                    title: data.title,
                    text: data.body[0]?.text ?? "",
                    ok: () => resolve({ data: {} }),
                    fail: (status) =>
                        reject(
                            new AxiosError("failed", undefined, undefined, undefined, {
                                status: status ?? 503,
                                data: {},
                                statusText: "",
                                headers: {},
                                config: { headers: new AxiosHeaders() },
                            })
                        ),
                });
            }),
    }),
}));
vi.mock("../features/notes/common/services/addNote", () => ({
    addNote: vi.fn(async () => null),
}));

// The bus drops a repeat of the same message for a few seconds: move past that between tests.
let clock = Date.parse("2026-11-28T00:00:00Z");
const __resetRequestErrors = () => vi.setSystemTime((clock += 60_000));

const doc = (text: string) => [{ type: "paragraph", text }] as never;

const note = (noteId: number, title = `Note ${noteId}`) =>
    ({ noteType: 1, noteId, title, body: doc("Start.") }) as unknown as MyNoteProps;

const myself = { teamId: "team", userId: "me" } as never;

type Props = { current: MyNoteProps | null; resync?: number };

const mount = (initial: MyNoteProps, onNoteUpdate = vi.fn()) => {
    const hook = renderHook(
        ({ current, resync }: Props) =>
            useNoteEditorCore<MyNoteProps>({
                currentNote: current,
                myself,
                accessToken: "token",
                socket: null,
                onNoteUpdate,
                resyncSignal: resync,
            }),
        { initialProps: { current: initial, resync: 0 } as Props }
    );
    // The editor: a keystroke marks the note edited at once, its text reaches the hook later.
    const editor = { text: "Start." };
    const attach = () => {
        const ref = hook.result.current.bodyReadRef;
        if (ref) ref.current = () => doc(editor.text);
    };
    attach();
    return {
        ...hook,
        editor,
        attach,
        onNoteUpdate,
        keystroke: (text: string) =>
            act(() => {
                editor.text = text;
                hook.result.current.setNoteBodyEdited(true);
                hook.result.current.setNoteBodySaved(false);
            }),
        sync: () => act(() => hook.result.current.handleBodyChange(doc(editor.text))),
    };
};

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const answer = (reply: () => void) =>
    act(async () => {
        reply();
        await vi.advanceTimersByTimeAsync(0);
    });
const texts = () => net.puts.map((put) => put.text);

/** Type, let the editor sync, and let the autosave send it. */
const typeAndSend = async (ed: ReturnType<typeof mount>, text: string) => {
    await ed.keystroke(text);
    await ed.sync();
    await wait(3000);
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    net.puts.length = 0;
    net.stored = "Start.";
    net.gets = 0;
    localStorage.clear();
    __resetRequestErrors();
    clearNoteCache();
});
afterEach(async () => {
    // Saves of one note wait for each other across panels: leave none unanswered behind.
    for (let i = 0; i < net.puts.length; i++) await answer(net.puts[i].ok);
    cleanup();
    for (let i = 0; i < net.puts.length; i++) await answer(net.puts[i].ok);
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("words typed while a save is on its way", () => {
    it("are sent after it returns", async () => {
        const ed = mount(note(1));
        await typeAndSend(ed, "The page works");
        await ed.keystroke("The page works, improve it.");
        await ed.sync();
        await answer(net.puts[0].ok);

        expect(ed.result.current.noteBodySaved).toBe(false);
        await wait(3000);
        expect(texts()).toEqual(["The page works", "The page works, improve it."]);

        await answer(net.puts[1].ok);
        expect(ed.result.current.noteBodySaved).toBe(true);
        await wait(10_000);
        expect(net.puts).toHaveLength(2);
    });

    it("are sent even when the editor has not synced them yet", async () => {
        const ed = mount(note(1));
        await typeAndSend(ed, "The page works");
        await ed.keystroke("The page works, improve it.");
        await answer(net.puts[0].ok);
        await wait(3000);

        expect(texts()).toEqual(["The page works", "The page works, improve it."]);
    });

    it("do not overtake an older save that is still in flight", async () => {
        const ed = mount(note(1));
        await typeAndSend(ed, "old");
        await typeAndSend(ed, "old and new");
        // Two in flight can land in either order, and the older text landing last stays.
        expect(texts()).toEqual(["old"]);

        await answer(net.puts[0].ok);
        expect(texts()).toEqual(["old", "old and new"]);
        await answer(net.puts[1].ok);
        expect(ed.result.current.noteBodySaved).toBe(true);
        await wait(10_000);
        expect(net.puts).toHaveLength(2);
    });

    it("keep a rename that was typed meanwhile", async () => {
        const ed = mount(note(1));
        await typeAndSend(ed, "body");
        act(() => ed.result.current.handleTitleChange("Renamed"));
        await answer(net.puts[0].ok);

        expect(ed.result.current.title).toBe("Renamed");
        act(() => ed.result.current.handleTitleBlur());
        await wait(0);
        expect(net.puts[1].title).toBe("Renamed");
    });
});

describe("a save that stored nothing", () => {
    it("is sent again while the server is down, and never shown as saved", async () => {
        const ed = mount(note(1));
        await typeAndSend(ed, "written while down");
        await answer(() => net.puts[0].fail(503));

        expect(ed.result.current.noteBodySaved).toBe(false);
        expect(getCachedNote("my", 1)).toBeNull();
        expect(ed.onNoteUpdate).not.toHaveBeenCalled();

        await wait(3000);
        await answer(() => net.puts[1].fail(503));
        // The second retry waits longer than the autosave delay.
        await wait(3000);
        expect(net.puts).toHaveLength(2);
        await wait(6000);
        await answer(net.puts[2].ok);

        expect(texts()).toEqual(Array(3).fill("written while down"));
        expect(ed.result.current.noteBodySaved).toBe(true);
    });

    it("does not drop the typed body when it was the rename that was refused", async () => {
        const ed = mount(note(1));
        await ed.keystroke("typed body");
        await ed.sync();
        act(() => ed.result.current.handleTitleChange("A refused title"));
        act(() => ed.result.current.handleTitleBlur());
        await wait(0);
        await answer(() => net.puts[0].fail(400));
        await wait(3000);

        expect(net.puts.map((p) => [p.title, p.text])).toEqual([
            ["A refused title", "typed body"],
            ["Note 1", "typed body"],
        ]);
    });

    it("does not trust what was confirmed before an answer got lost", async () => {
        const ed = mount(note(1));
        await typeAndSend(ed, "X");
        await answer(net.puts[0].ok);
        // The server stores Y, its answer never arrives, and the person undoes back to X.
        await typeAndSend(ed, "Y");
        await answer(() => net.puts[1].fail(503));
        await ed.keystroke("X");
        await ed.sync();
        await wait(6000);

        expect(texts()).toEqual(["X", "Y", "X"]);
    });

    it("is not repeated when the server refused it", async () => {
        const ed = mount(note(1));
        await typeAndSend(ed, "not mine to write");
        await answer(() => net.puts[0].fail(403));
        await wait(60_000);

        expect(net.puts).toHaveLength(1);
        expect(ed.result.current.noteBodySaved).toBe(false);
    });
});

describe("leaving the note", () => {
    it("sends the words still in the editor when the panel closes", async () => {
        const ed = mount(note(1));
        await ed.keystroke("typed just before closing");
        ed.unmount();
        await wait(0);

        expect(texts()).toEqual(["typed just before closing"]);
    });

    it("sends nothing for a note that was only read", async () => {
        const ed = mount(note(1));
        await ed.sync();
        ed.unmount();
        await wait(10_000);

        expect(net.puts).toHaveLength(0);
    });

    it("does not send a body the server already confirmed", async () => {
        const ed = mount(note(1));
        await typeAndSend(ed, "all of it");
        ed.unmount();
        await answer(net.puts[0].ok);

        expect(net.puts).toHaveLength(1);
    });

    it("saves the outgoing note, not onto the one the panel shows next", async () => {
        const ed = mount(note(1));
        const outgoingSetBody = ed.result.current.handleBodyChange;
        await ed.keystroke("words of the first note");

        ed.rerender({ current: note(2) });
        await wait(0);
        expect(net.puts.map((p) => [p.noteId, p.text])).toEqual([[1, "words of the first note"]]);

        // A late sync of the outgoing editor must not reach the new note.
        act(() => outgoingSetBody(doc("late")));
        expect(ed.result.current.body).toEqual(doc("Start."));
        await answer(net.puts[0].ok);
        await wait(10_000);
        expect(net.puts).toHaveLength(1);
        expect(ed.result.current.noteBodySaved).toBe(false);
    });

    it("does not write the old text over a restored version", async () => {
        const ed = mount(note(1));
        await typeAndSend(ed, "first");
        await ed.keystroke("before the restore");
        await ed.sync();
        await wait(3000);

        ed.rerender({ current: note(1), resync: 1 });
        await answer(net.puts[0].ok);
        await wait(10_000);

        expect(texts()).toEqual(["first"]);
    });
});

describe("the chat panel's copy of a note", () => {
    const chatNote = (noteId: number, title: string) =>
        ({ noteType: 3, noteId, title }) as unknown as ChatNoteProps;

    it("takes a late save without switching to it or reopening a closed tab", () => {
        const { result } = renderHook(() => useChatPanelNote({ myself, accessToken: "token" }));
        act(() => result.current.setNote(chatNote(1, "one")));
        act(() => result.current.setNote(chatNote(2, "two")));

        act(() => result.current.updateNote(chatNote(1, "one, saved")));
        expect(result.current.note?.noteId).toBe(2);
        expect(result.current.tabs.map((t) => t.title)).toEqual(["one, saved", "two"]);

        act(() => result.current.closeTab(1));
        act(() => result.current.updateNote(chatNote(1, "one, saved late")));
        expect(result.current.tabs.map((t) => t.noteId)).toEqual([2]);
    });
});

describe("words that could not be saved (MIP-2463)", () => {
    const kept = (noteId = 1) => readUnsavedNoteBody("me", `1-${noteId}`);
    const myselfWithId = { teamId: "team", userId: "me" };
    const heard = () => {
        const kinds: string[] = [];
        const stop = subscribeRequestErrors((kind) => kinds.push(kind));
        return { kinds, stop };
    };
    beforeEach(() => {
        (myself as { userId: string }).userId = myselfWithId.userId;
    });

    it("tells the person when the server refuses the save, and keeps the words", async () => {
        const bus = heard();
        const ed = mount(note(1));
        await typeAndSend(ed, "refused words");
        await answer(() => net.puts[0].fail(403));
        bus.stop();

        expect(bus.kinds).toEqual(["noteNotSaved"]);
        expect(kept()?.body).toEqual(doc("refused words"));
    });

    it("says nothing while the server is only down", async () => {
        const bus = heard();
        const ed = mount(note(1));
        await typeAndSend(ed, "typed");
        await answer(() => net.puts[0].fail(503));
        bus.stop();

        expect(bus.kinds).toEqual([]);
    });

    it("sends a failed leave save when the note is next opened", async () => {
        const first = mount(note(1));
        await first.keystroke("typed just before leaving");
        first.unmount();
        await answer(() => net.puts[0].fail(503));
        expect(kept()?.body).toEqual(doc("typed just before leaving"));

        mount(note(1));
        await wait(0);
        expect(texts()).toEqual(["typed just before leaving", "typed just before leaving"]);
        expect(net.puts[1].title).toBe("Server title");
        await answer(net.puts[1].ok);
        expect(kept()).toBeNull();
    });

    it("keeps nothing once the leave save is stored", async () => {
        const ed = mount(note(1));
        await ed.keystroke("typed just before leaving");
        ed.unmount();
        await answer(net.puts[0].ok);

        expect(kept()).toBeNull();
    });

    it("keeps the words on a reload or a closed tab", async () => {
        const ed = mount(note(1));
        await ed.keystroke("typed, then reloaded");
        await act(async () => {
            window.dispatchEvent(new Event("pagehide"));
        });

        expect(kept()?.body).toEqual(doc("typed, then reloaded"));
    });

    it("never writes over a note someone changed since", async () => {
        const first = mount(note(1));
        await first.keystroke("mine");
        first.unmount();
        await answer(() => net.puts[0].fail(503));

        net.stored = "written by someone else";
        mount(note(1));
        await wait(0);

        expect(net.gets).toBe(1);
        expect(net.puts).toHaveLength(1);
        expect(kept()).toBeNull();
    });

    it("does not send the old body back on a rename after the repair", async () => {
        const first = mount(note(1));
        await first.keystroke("repaired words");
        first.unmount();
        await answer(() => net.puts[0].fail(503));

        const again = mount(note(1));
        again.editor.text = "repaired words";
        await wait(0);
        await answer(net.puts[1].ok);
        act(() => again.result.current.handleTitleChange("Renamed"));
        await act(async () => void again.result.current.handleTitleBlur());

        expect(net.puts[2].text).toBe("repaired words");
    });

    it("stops trying, and says so, when the repair is refused", async () => {
        const first = mount(note(1));
        await first.keystroke("mine");
        first.unmount();
        await answer(() => net.puts[0].fail(503));

        const bus = heard();
        mount(note(1));
        await wait(0);
        await answer(() => net.puts[1].fail(403));
        bus.stop();

        expect(bus.kinds).toEqual(["noteNotSaved"]);
        expect(kept()).toBeNull();
    });

    it("is cleared on sign-out and not written back by the editor that closes after it", async () => {
        const ed = mount(note(1));
        await ed.keystroke("private words");
        clearSignOutLocalStorage();
        ed.unmount();
        await answer(() => net.puts[0].fail(401));

        const left = Object.keys(localStorage).filter((k) =>
            k.startsWith(UNSAVED_NOTE_BODY_PREFIX)
        );
        expect(left).toEqual([]);
    });
});
