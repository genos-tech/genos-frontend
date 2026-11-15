/**
 * The calm note for `dropped_references` on a run that pauses (MIP-1585), as a member sees it, on
 * every host that renders an answer turn: Spotlight and the Genos page (`SpotlightContent`) and the
 * thread and note Ask windows (`AgentQAConversation`; the task window renders through the same one).
 *
 * Two layers:
 *   1. The paused, still-live turn says it BEFORE the member decides: the card's event is the only
 *      place the ask's drops are said on a run that pauses, and a write proposed without the message
 *      the member pointed at is exactly what they should know before approving.
 *   2. The whole path, with the REAL stream parser and the REAL hook: an ask that pauses on a card
 *      carrying `["message"]`, an approve whose resumed `done` carries `["message", "task"]`. The
 *      member reads each sentence once, on the turn that finishes, and none while nothing was dropped.
 */

import type { ReactElement } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    useAgentQA,
    type AskState,
    type CompletedTurn,
    type UseAgentQAReturn,
} from "../features/agentQA";
import type { AgentMentionRef } from "../features/agentQA/mentions/types";
import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { NoteAskModal } from "../features/noteAsk/NoteAskModal";
import type { UseNoteAskReturn } from "../features/noteAsk/useNoteAsk";
import { SpotlightContent } from "../features/spotlight/SpotlightContent";
import { ThreadAskModal } from "../features/threadAsk/ThreadAskModal";
import type { UseThreadAskReturn } from "../features/threadAsk/useThreadAsk";
import { en } from "../i18n/locales/en";
import type { PendingApprovalPayload } from "../services/agentApi";

// The mention picker drags in the team/task/note stores and isn't under test.
vi.mock("../features/agentQA", async () => {
    const actual =
        await vi.importActual<typeof import("../features/agentQA")>("../features/agentQA");
    return {
        ...actual,
        AgentQAInput: () => <div data-testid="qa-input" />,
    };
});

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

const MESSAGE_REF: AgentMentionRef = {
    kind: "message",
    messageId: "5b0c3a52-6a31-4f1a-9a30-0e7f4a8f1c11",
    label: "Alice 14:02",
};

const PENDING: PendingApprovalPayload = {
    step: 1,
    tool_name: "add_comment",
    arguments: { task_id: 12, body: "Done" },
    approval_token: "ap-1",
    run_id: "run-3",
};

const live = (over: Partial<AskState> = {}): AskState => ({
    ...EMPTY_ASK_STATE,
    askedQuery: "Reply to this",
    askedMentions: [MESSAGE_REF],
    pendingApproval: PENDING,
    ...over,
});

const DROPPED = en.spotlight.dropped;

// --- one stub of each host's state, around a real or a fixed `ask` -------------------------------

const agentQAStub = (turns: CompletedTurn[], ask: AskState): UseAgentQAReturn =>
    ({
        query: "",
        setQuery: vi.fn(),
        ask,
        turns,
        sessionId: "sess-1",
        onAsk: vi.fn(),
        onCancel: vi.fn(),
        onApprove: vi.fn(),
        onReject: vi.fn(),
        clearConversation: vi.fn(),
        reset: vi.fn(),
        submitFeedback: vi.fn(),
    }) as unknown as UseAgentQAReturn;

const threadAskModal = (agentQA: UseAgentQAReturn) => {
    const state = {
        isOpen: true,
        open: vi.fn(),
        close: vi.fn(),
        threadContext: { chatType: 2, chatId: 77, threadId: 404 },
        summary: {
            text: "Ten messages about the launch.",
            lastUpdatedIso: "2026-07-29T09:00:00Z",
            fingerprint: "fp-1",
            messageCount: 10,
        },
        summaryLoading: false,
        summaryError: null,
        refreshSummary: vi.fn(),
        staleSummary: false,
        agentQA,
    } as unknown as UseThreadAskReturn;
    return (
        <CssVarsProvider>
            <ThreadAskModal
                accessToken="tok"
                chatName="Launch"
                myself={{ userId: "u1", teamId: "t1" } as never}
                state={state}
                onSelectSource={vi.fn()}
            />
        </CssVarsProvider>
    );
};

const noteAskModal = (agentQA: UseAgentQAReturn) => {
    const state = {
        isOpen: true,
        open: vi.fn(),
        close: vi.fn(),
        noteContext: { noteType: 1, noteId: 5 },
        summary: {
            text: "A note about the launch.",
            lastUpdatedIso: "2026-07-29T09:00:00Z",
            fingerprint: "fp-1",
            bodyLength: 120,
            noteTitle: "Launch",
        },
        summaryLoading: false,
        summaryError: null,
        refreshSummary: vi.fn(),
        staleSummary: false,
        agentQA,
    } as unknown as UseNoteAskReturn;
    return (
        <CssVarsProvider>
            <NoteAskModal state={state} onSelectSource={vi.fn()} />
        </CssVarsProvider>
    );
};

const spotlightContent = (turns: CompletedTurn[], ask: AskState, onApprove = vi.fn()) => (
    <CssVarsProvider>
        <SpotlightContent
            ask={ask}
            backToHistoryList={vi.fn()}
            closeHistory={vi.fn()}
            error={null}
            filterServices={[]}
            historyDetail={null}
            historyIsLoading={false}
            historyLoadFailed={false}
            historyMode="closed"
            historySessions={[]}
            isLoading={false}
            openHistory={vi.fn()}
            query=""
            results={[]}
            turns={turns}
            variant="page"
            viewHistorySession={vi.fn()}
            aiAnswersEnabled
            onApprove={onApprove}
            onAsk={vi.fn()}
            onCancel={vi.fn()}
            onFeedback={vi.fn()}
            onNewConversation={vi.fn()}
            onOpenSettings={vi.fn()}
            onPreview={vi.fn()}
            onQueryChange={vi.fn()}
            onReject={vi.fn()}
            onSelect={vi.fn()}
            onToggleFilterService={vi.fn()}
            onUndo={vi.fn()}
        />
    </CssVarsProvider>
);

interface Surface {
    name: string;
    element: (ask: AskState) => ReactElement;
}

const SURFACES: Surface[] = [
    { name: "Spotlight", element: (ask) => spotlightContent([], ask) },
    { name: "ThreadAskModal", element: (ask) => threadAskModal(agentQAStub([], ask)) },
    { name: "NoteAskModal", element: (ask) => noteAskModal(agentQAStub([], ask)) },
];

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe.each(SURFACES)("$name: a turn that is paused on a card", (surface) => {
    it("says what the ask could not use, once, beside the card", () => {
        render(surface.element(live({ droppedReferences: ["message"] })));
        expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
        const notes = screen.getAllByRole("status");
        expect(notes).toHaveLength(1);
        expect(notes[0].textContent).toBe(DROPPED.message);
    });

    it("says a lost task with its own sentence, calmly", () => {
        render(surface.element(live({ droppedReferences: ["task"], askedMentions: [] })));
        const note = screen.getByRole("status");
        expect(note.textContent).toBe(DROPPED.task);
        expect(note.textContent).not.toMatch(/\bread\b|deleted|missing|permission/i);
    });

    it("says every kind it carries, one sentence each, in order", () => {
        render(surface.element(live({ droppedReferences: ["selection", "message", "task"] })));
        const note = screen.getByRole("status");
        expect(note.textContent).toBe(`${DROPPED.selection}${DROPPED.message}${DROPPED.task}`);
    });

    it("says nothing when nothing was dropped (the flag off, or a card with no field)", () => {
        render(surface.element(live()));
        expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
        expect(screen.queryByRole("status")).toBeNull();
    });
});

// --- the whole path ---------------------------------------------------------------------------

const ndjson = (events: unknown[]): Response => {
    const payload = new TextEncoder().encode(events.map((e) => JSON.stringify(e) + "\n").join(""));
    let sent = false;
    return {
        ok: true,
        body: {
            getReader: () => ({
                read: async () =>
                    sent
                        ? { value: undefined, done: true as const }
                        : ((sent = true), { value: payload, done: false as const }),
                releaseLock() {},
            }),
        },
    } as unknown as Response;
};

const CARD_EVENT = {
    type: "tool_call_pending_approval",
    step: 1,
    tool_name: "add_comment",
    arguments: { task_id: 12, body: "Done" },
    editable: [],
    approval_token: "ap-1",
    run_id: "run-1",
};

/** The real hook inside a thread Ask window, the real parser, a fetch that answers the two legs. */
const mountWholePath = (askEvents: unknown[], decideEvents: unknown[]) => {
    const fetchMock = vi.fn(async (url: string) =>
        ndjson(String(url).includes("/agent/decide/") ? decideEvents : askEvents)
    );
    vi.stubGlobal("fetch", fetchMock);
    let hook: UseAgentQAReturn | null = null;
    const Harness = () => {
        const agentQA = useAgentQA({ accessToken: "tok", teamId: "team-1" });
        hook = agentQA;
        return threadAskModal(agentQA);
    };
    render(<Harness />);
    const ask = async () => {
        await act(async () => {
            hook?.onAsk("Reply to this", [MESSAGE_REF]);
        });
    };
    return { ask, fetchMock };
};

const sentenceCount = (haystack: string, sentence: string) => haystack.split(sentence).length - 1;

describe("the whole path, with the real stream parser and the real hook", () => {
    it("a paused run that dropped a message says so on the card, and once on the finished turn", async () => {
        const { ask, fetchMock } = mountWholePath(
            [
                { type: "tool_call_start", step: 1, tool_name: "add_comment", arguments: {} },
                { ...CARD_EVENT, dropped_references: ["message"] },
            ],
            [
                { type: "answer_delta", text: "I added the comment." },
                // The resumed leg says it again (the same field, the server repeats it).
                {
                    type: "done",
                    session_id: "s1",
                    run_id: "run-1",
                    dropped_references: ["message"],
                },
            ]
        );
        await ask();
        await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy());
        expect(screen.getByRole("status").textContent).toBe(DROPPED.message);

        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        await waitFor(() => expect(screen.getByText("I added the comment.")).toBeTruthy());
        await waitFor(() => expect(screen.queryByRole("button", { name: "Approve" })).toBeNull());

        const notes = screen.getAllByRole("status");
        expect(notes).toHaveLength(1);
        expect(sentenceCount(notes[0].textContent ?? "", DROPPED.message)).toBe(1);
        expect(notes[0].textContent).toBe(DROPPED.message);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("a resumed leg that dropped a task adds its sentence to the one already there", async () => {
        const { ask } = mountWholePath(
            [
                { type: "tool_call_start", step: 1, tool_name: "add_comment", arguments: {} },
                { ...CARD_EVENT, dropped_references: ["message"] },
            ],
            [
                { type: "answer_delta", text: "Added." },
                {
                    type: "done",
                    session_id: "s1",
                    run_id: "run-1",
                    dropped_references: ["message", "task"],
                },
            ]
        );
        await ask();
        await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy());
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        await waitFor(() => expect(screen.getByText("Added.")).toBeTruthy());
        await waitFor(() =>
            expect(screen.getByRole("status").textContent).toContain(DROPPED.task)
        );

        const notes = screen.getAllByRole("status");
        expect(notes).toHaveLength(1);
        expect(notes[0].textContent).toBe(`${DROPPED.message}${DROPPED.task}`);
    });

    it("a kind this client does not know is ignored on the card and on the done", async () => {
        const { ask } = mountWholePath(
            [
                { type: "tool_call_start", step: 1, tool_name: "add_comment", arguments: {} },
                { ...CARD_EVENT, dropped_references: ["thread"] },
            ],
            [
                { type: "answer_delta", text: "Added." },
                {
                    type: "done",
                    session_id: "s1",
                    run_id: "run-1",
                    dropped_references: ["sprint"],
                },
            ]
        );
        await ask();
        await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy());
        expect(screen.queryByRole("status")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        await waitFor(() => expect(screen.getByText("Added.")).toBeTruthy());
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("the server flag off: a card and a done with no field show no note at all", async () => {
        const { ask } = mountWholePath(
            [
                { type: "tool_call_start", step: 1, tool_name: "add_comment", arguments: {} },
                CARD_EVENT,
            ],
            [
                { type: "answer_delta", text: "Added." },
                { type: "done", session_id: "s1", run_id: "run-1" },
            ]
        );
        await ask();
        await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy());
        expect(screen.queryByRole("status")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        await waitFor(() => expect(screen.getByText("Added.")).toBeTruthy());
        expect(screen.queryByRole("status")).toBeNull();
    });
});
