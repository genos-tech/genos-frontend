/**
 * History survives a page refresh — for CHATS as well as tasks/notes.
 *
 * The bug these guard: `HistoryEntry.chatId` was typed `number` from the
 * legacy contract, but v3 chat ids are UUID strings, so
 * `useHistoryTracker` wrote them through a `as unknown as number` cast.
 * In-memory everything worked (renders and comparisons stringify), and
 * the localStorage write succeeded — but the runtime narrowing check on
 * READ (`typeof o.chatId === "number"`) rejected every one of those rows,
 * so the Chats tab came back empty after a reload while Tasks and Notes
 * (genuinely numeric ids) came back intact. Exactly the asymmetry the
 * user reported.
 *
 * A refresh is modelled as: mount → record → unmount → mount a FRESH
 * provider against the same localStorage. That's the only way to cover
 * this; asserting on in-memory state after `record` passes even when the
 * persisted row is unreadable.
 */
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    ChatHistoryEntry,
    HistoryEntry,
    HistoryProvider,
    ThreadHistoryEntry,
    useHistory,
} from "../hooks/common/useHistory";

const TEAM = "team-1";
const STORAGE_KEY = `genos.history.v1.${TEAM}`;

// v3 ids are UUIDs. Deliberately the real shape rather than a stub
// string: `isV3Uuid`-style checks elsewhere key off the dash count.
const CHANNEL_UUID = "3f7b1c22-9a4e-4c1f-8f2a-b6d5e4c3a201";
const PARENT_MSG_UUID = "8c2d5e10-77af-4b39-9e61-2a4c8d0f1b53";

type Api = ReturnType<typeof useHistory>;

// Grabs the context value so a test can call `record` and read entries
// back without going through the modal.
let api: Api;
const Probe = () => {
    api = useHistory();
    return null;
};

const mount = () =>
    render(
        <HistoryProvider teamId={TEAM}>
            <Probe />
        </HistoryProvider>
    );

// Mount → run → unmount, leaving only localStorage behind. The next
// `session()` is a page refresh.
const session = (run: (a: Api) => void) => {
    const view = mount();
    act(() => run(api));
    view.unmount();
};

const chatEntry = (over: Partial<ChatHistoryEntry> = {}): ChatHistoryEntry => ({
    kind: "chat",
    chatType: 2,
    chatId: CHANNEL_UUID,
    label: "Design GM",
    openedAt: 1_700_000_000_000,
    ...over,
});

const threadEntry = (over: Partial<ThreadHistoryEntry> = {}): ThreadHistoryEntry => ({
    kind: "thread",
    chatType: 2,
    chatId: CHANNEL_UUID,
    threadId: PARENT_MSG_UUID,
    label: "Design GM",
    openedAt: 1_700_000_001_000,
    ...over,
});

const stored = (): unknown[] => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe("chat history survives a refresh", () => {
    it("keeps a v3 UUID chat row after a reload", () => {
        session((a) => a.record(chatEntry()));
        // The row reached storage — the write was never the problem.
        expect(stored()).toHaveLength(1);

        mount();
        expect(api.chatsEntries).toHaveLength(1);
        expect(api.chatsEntries[0].chatId).toBe(CHANNEL_UUID);
        expect(api.chatsEntries[0].label).toBe("Design GM");
    });

    it("keeps a v3 thread row, whose threadId is also a UUID", () => {
        // Threads carry the channel UUID in `chatId` AND the parent
        // message's UUID in `threadId`, so they failed the guard on two
        // fields, not one.
        session((a) => a.record(threadEntry()));

        mount();
        expect(api.chatsEntries).toHaveLength(1);
        const row = api.chatsEntries[0] as ThreadHistoryEntry;
        expect(row.kind).toBe("thread");
        expect(row.chatId).toBe(CHANNEL_UUID);
        expect(row.threadId).toBe(PARENT_MSG_UUID);
    });

    it("keeps chats alongside the tasks and notes that already worked", () => {
        // The user's report was an ASYMMETRY — tasks and notes survived,
        // chats didn't. Pin all three together so a future change can't
        // fix chats by breaking the other two.
        session((a) => {
            a.record(chatEntry());
            a.record({
                kind: "task",
                taskId: 42,
                projectId: 7,
                label: "Ship it",
                openedAt: 1_700_000_002_000,
            });
            a.record({
                kind: "note",
                noteType: 1,
                noteId: 9,
                label: "Scratch",
                openedAt: 1_700_000_003_000,
            });
        });

        mount();
        expect(api.chatsEntries).toHaveLength(1);
        expect(api.tasksEntries).toHaveLength(1);
        expect(api.notesEntries).toHaveLength(1);
    });

    it("still reads rows written before v3, whose ids are real numbers", () => {
        // Legacy rows are already in users' localStorage. Widening the
        // guard must not trade one silent drop for another, so seed the
        // numeric shape directly rather than through `record`.
        const legacy = [
            { kind: "chat", chatType: 1, chatId: 12, label: "Old DM", openedAt: 1 },
            { kind: "thread", chatType: 1, chatId: 12, threadId: 4, label: "Old DM", openedAt: 2 },
        ];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

        mount();
        expect(api.chatsEntries).toHaveLength(2);
        // Normalized to the canonical string shape on read, so downstream
        // consumers see one type regardless of when the row was written.
        expect(api.chatsEntries[0].chatId).toBe("12");
        expect((api.chatsEntries[1] as ThreadHistoryEntry).threadId).toBe("4");
    });

    it("collapses a legacy numeric row and its v3 string twin into one", () => {
        // Same chat, one row written each side of the flip. They must
        // dedupe rather than show twice — `keyForEntry` interpolates the
        // id, so "12" and 12 already produce the same key; this pins it.
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([
                { kind: "chat", chatType: 1, chatId: "12", label: "Newer", openedAt: 2 },
                { kind: "chat", chatType: 1, chatId: 12, label: "Older", openedAt: 1 },
            ])
        );

        mount();
        expect(api.chatsEntries).toHaveLength(1);
        // Newest-first ordering means the first occurrence wins.
        expect(api.chatsEntries[0].label).toBe("Newer");
    });

    it("drops a row whose id is neither a string nor a number", () => {
        // The guard is still a guard: garbage must not reach the render
        // path, where `findChat` would compare against `String({})`.
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([
                { kind: "chat", chatType: 1, chatId: { nope: true }, label: "Bad", openedAt: 1 },
                { kind: "chat", chatType: 1, chatId: null, label: "Also bad", openedAt: 2 },
                chatEntry({ label: "Good" }),
            ])
        );

        mount();
        expect(api.chatsEntries).toHaveLength(1);
        expect(api.chatsEntries[0].label).toBe("Good");
    });

    it("persists an empty-string id as nothing, not as a row", () => {
        // `chatId === ""` is the v3 "uninitialized chat" sentinel. A row
        // keyed on it deep-links nowhere, so it must not be readable back
        // even if something managed to write one.
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([
                { kind: "chat", chatType: 1, chatId: "", label: "Empty", openedAt: 1 },
            ])
        );

        mount();
        expect(api.chatsEntries).toHaveLength(0);
    });

    it("keeps the per-message rows that make a chat row deep-linkable", () => {
        // messageId stays numeric (a seq), so it was never dropped — but
        // it rides on a chat row, which was. Two different messages in
        // one chat are separate rows and both have to come back.
        session((a) => {
            a.record(chatEntry({ messageId: 11, messageText: "first" }));
            a.record(chatEntry({ messageId: 22, messageText: "second" }));
        });

        mount();
        expect(api.chatsEntries).toHaveLength(2);
        expect(api.chatsEntries.map((e) => (e as ChatHistoryEntry).messageText)).toEqual([
            "second",
            "first",
        ]);
    });

    it("scopes restored history to the team it was recorded under", () => {
        session((a) => a.record(chatEntry()));

        const view = render(
            <HistoryProvider teamId="team-2">
                <Probe />
            </HistoryProvider>
        );
        expect(api.chatsEntries).toHaveLength(0);
        view.unmount();

        // Switching back restores it — the whole point of per-team keys.
        mount();
        expect(api.chatsEntries).toHaveLength(1);
    });

    it("clear() empties the tab and keeps it empty after a refresh", () => {
        session((a) => a.record(chatEntry()));
        session((a) => a.clear());

        mount();
        expect(api.chatsEntries).toHaveLength(0);
    });
});

describe("what gets written is what can be read", () => {
    // The regression was a WRITE/READ shape mismatch that no single-sided
    // test could see. This asserts the round trip as a property: anything
    // `record` persists, a fresh provider must return.
    const cases: [string, HistoryEntry][] = [
        ["chat", chatEntry()],
        ["thread", threadEntry()],
        ["task", { kind: "task", taskId: 1, projectId: 2, label: "T", openedAt: 10 }],
        [
            "milestone",
            { kind: "milestone", milestoneId: 3, projectId: 2, label: "M", openedAt: 11 },
        ],
        ["note", { kind: "note", noteType: 3, noteId: 4, label: "N", openedAt: 12 }],
    ];

    it.each(cases)("a %s entry round-trips through a refresh", (_kind, entry) => {
        window.localStorage.clear();
        session((a) => a.record(entry));

        mount();
        expect(api.entries).toHaveLength(1);
        expect(api.entries[0].kind).toBe(entry.kind);
    });
});
