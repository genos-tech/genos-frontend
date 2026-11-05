/**
 * One answer turn, three hosts: what a user can do with an answer is the same
 * in Spotlight / the Genos page and in the thread and note Ask modals.
 *
 * The turn used to be implemented twice (`TurnView` in SpotlightContent and
 * `TurnRow` / `InFlightTurn` in AgentQAConversation) and the two copies had
 * drifted. These tests drive each host through its PUBLIC entry point
 * (`SpotlightContent`, `ThreadAskModal`, `NoteAskModal`) with identical
 * fixtures and assert only behaviour that must hold on every host: they were
 * written against the two separate implementations and pass unchanged on the
 * single shared one.
 *
 * Deliberately NOT asserted here, because the hosts differ on purpose or the
 * wording moved: exact chip text (Spotlight localizes it), the Q/A chrome, and
 * the signature of each host's retry callback (only its first argument, the
 * question, is common).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { AskState, CompletedTurn, UseAgentQAReturn } from "../features/agentQA";
import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { NoteAskModal } from "../features/noteAsk/NoteAskModal";
import type { UseNoteAskReturn } from "../features/noteAsk/useNoteAsk";
import { SpotlightContent } from "../features/spotlight/SpotlightContent";
import type { SpotlightResult } from "../features/spotlight/types";
import { ThreadAskModal } from "../features/threadAsk/ThreadAskModal";
import type { UseThreadAskReturn } from "../features/threadAsk/useThreadAsk";
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

const source = (over: Partial<SpotlightResult> = {}): SpotlightResult => ({
    entity_type: "task",
    entity_id: "task:12",
    title: "Fix login redirect",
    snippet: null,
    score: 1,
    keyword_rank: 1,
    vector_rank: null,
    matched_chunk_types: ["task_title_body"],
    matched_terms: [],
    updated_at: null,
    chat_type: null,
    chat_id: null,
    thread_id: null,
    message_id: null,
    task_id: "12",
    task_display_id: "PRJ-12",
    note_id: null,
    note_type: null,
    project_id: "7",
    related_entity_ids: [],
    ...over,
});

const TASK = source();
const NOTE = source({
    entity_type: "note",
    entity_id: "note:personal:42",
    title: "Release notes",
    task_id: null,
    task_display_id: null,
    note_id: "42",
    note_type: "personal",
});
const UNCITED = source({ entity_id: "task:99", task_id: "99", title: "Unrelated spike" });

const MILESTONE = source({
    entity_type: "milestone",
    entity_id: "milestone:9",
    title: "Beta launch",
    task_id: "9",
    task_display_id: "PRJ-9",
});

const MENTIONS = [{ kind: "user" as const, userId: "u2", label: "Bob" }];

// Turn 1: an inline citation, a bare token, and a retrieved-but-uncited source.
const TURN_ONE: CompletedTurn = {
    id: 1,
    askedQuery: "What shipped last week?",
    answer: "Shipped in [the fix](task:12) last week. See [note:personal:42].",
    answerSources: [TASK, NOTE, UNCITED],
    toolEvents: [],
    askError: null,
    runId: "run-1",
    elapsedMs: 1800,
    mentions: MENTIONS,
};

// Turn 2 re-cites turn 1's task but retrieved nothing itself: the server
// replays earlier answers to the model, so it can copy a citation across.
const TURN_TWO: CompletedTurn = {
    id: 2,
    askedQuery: "And is it done?",
    answer: "As before, [the fix](task:12) is done.",
    answerSources: [],
    toolEvents: [],
    askError: null,
    runId: "run-2",
};

const ERROR_TURN: CompletedTurn = {
    id: 3,
    askedQuery: "Break please",
    answer: "",
    answerSources: [],
    toolEvents: [],
    askError: "stub failure",
    runId: null,
};

const PENDING: PendingApprovalPayload = {
    step: 1,
    tool_name: "update_task",
    arguments: { task_id: 12, status: "Done" },
    approval_token: "ap-1",
    run_id: "run-3",
};

const liveAsk = (over: Partial<AskState> = {}): AskState => ({
    ...EMPTY_ASK_STATE,
    askedQuery: "Mark it done",
    ...over,
});

type Spy = Mock<(...args: unknown[]) => unknown>;

interface Handlers {
    openSource: Spy;
    retry: Spy;
    feedback: Spy;
    approve: Spy;
    reject: Spy;
}

interface Surface {
    name: string;
    mount: (args: { turns: CompletedTurn[]; ask?: AskState }) => Handlers;
}

const spotlight: Surface = {
    name: "Spotlight",
    mount: ({ turns, ask }) => {
        const h: Handlers = {
            openSource: vi.fn(),
            retry: vi.fn(),
            feedback: vi.fn(),
            approve: vi.fn(),
            reject: vi.fn(),
        };
        render(
            <CssVarsProvider>
                <SpotlightContent
                    ask={ask ?? { ...EMPTY_ASK_STATE }}
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
                    onApprove={h.approve}
                    onAsk={h.retry}
                    onCancel={vi.fn()}
                    onFeedback={h.feedback}
                    onNewConversation={vi.fn()}
                    onOpenSettings={vi.fn()}
                    onPreview={h.openSource}
                    onQueryChange={vi.fn()}
                    onReject={h.reject}
                    onSelect={vi.fn()}
                    onToggleFilterService={vi.fn()}
                />
            </CssVarsProvider>
        );
        return h;
    },
};

const agentQAState = (turns: CompletedTurn[], ask: AskState | undefined, h: Handlers) =>
    ({
        query: "",
        setQuery: vi.fn(),
        ask: ask ?? { ...EMPTY_ASK_STATE },
        turns,
        sessionId: "sess-1",
        onAsk: h.retry,
        onCancel: vi.fn(),
        onApprove: h.approve,
        onReject: h.reject,
        clearConversation: vi.fn(),
        reset: vi.fn(),
        submitFeedback: h.feedback,
    }) as unknown as UseAgentQAReturn;

const newHandlers = (): Handlers => ({
    openSource: vi.fn(),
    retry: vi.fn(),
    feedback: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
});

const threadAsk: Surface = {
    name: "ThreadAskModal",
    mount: ({ turns, ask }) => {
        const h = newHandlers();
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
            agentQA: agentQAState(turns, ask, h),
        } as unknown as UseThreadAskReturn;
        render(
            <CssVarsProvider>
                <ThreadAskModal
                    accessToken="tok"
                    chatName="Launch"
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    state={state}
                    onSelectSource={h.openSource}
                />
            </CssVarsProvider>
        );
        return h;
    },
};

const noteAsk: Surface = {
    name: "NoteAskModal",
    mount: ({ turns, ask }) => {
        const h = newHandlers();
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
            agentQA: agentQAState(turns, ask, h),
        } as unknown as UseNoteAskReturn;
        render(
            <CssVarsProvider>
                <NoteAskModal state={state} onSelectSource={h.openSource} />
            </CssVarsProvider>
        );
        return h;
    },
};

const SURFACES = [spotlight, threadAsk, noteAsk];

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe.each(SURFACES)("$name: a finished answer", (surface) => {
    it("renders the answer prose and the question", () => {
        surface.mount({ turns: [TURN_ONE] });
        expect(screen.getByText(/What shipped last week\?/)).toBeTruthy();
        expect(screen.getByText(/Shipped in/)).toBeTruthy();
    });

    it("turns an inline citation into a button that opens the source", () => {
        const h = surface.mount({ turns: [TURN_ONE] });
        fireEvent.click(screen.getByRole("button", { name: "the fix" }));
        expect(h.openSource).toHaveBeenCalledWith(TASK);
    });

    it("strips the bare [type:id] token from the prose and chips the source", () => {
        const h = surface.mount({ turns: [TURN_ONE] });
        expect(screen.queryByText(/note:personal:42/)).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /Release notes/ }));
        expect(h.openSource).toHaveBeenCalledWith(NOTE);
    });

    it("chips the sources the answer cited and drops the uncited one", () => {
        surface.mount({ turns: [TURN_ONE] });
        // The inline-cited task shows both as a link and as a chip.
        expect(screen.getAllByRole("button", { name: /Fix login redirect|the fix/ }).length).toBe(
            2
        );
        expect(screen.queryByText(/Unrelated spike/)).toBeNull();
    });

    it("shows how long the answer took, in English", () => {
        surface.mount({ turns: [TURN_ONE] });
        expect(screen.getByText("Answered in 1.8s")).toBeTruthy();
    });

    it("copies the answer text", async () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText },
        });
        surface.mount({ turns: [TURN_TWO] });
        fireEvent.click(screen.getByRole("button", { name: "Copy answer" }));
        expect(writeText).toHaveBeenCalledWith(TURN_TWO.answer);
    });

    it("re-asks the same question from Ask again", () => {
        const h = surface.mount({ turns: [TURN_ONE] });
        fireEvent.click(screen.getByRole("button", { name: "Ask again" }));
        expect(h.retry).toHaveBeenCalledTimes(1);
        // Common to every host: the question, then the mentions it carried.
        expect(h.retry.mock.calls[0][0]).toBe("What shipped last week?");
        expect(h.retry.mock.calls[0][1]).toEqual(MENTIONS);
    });

    it("rates the answer through the run id", () => {
        const h = surface.mount({ turns: [TURN_ONE] });
        fireEvent.click(screen.getByRole("button", { name: "Good answer" }));
        expect(h.feedback).toHaveBeenCalledWith("run-1", 1);
    });

    it("has no thumbs on an answer with no run id", () => {
        surface.mount({ turns: [{ ...TURN_ONE, runId: null }] });
        expect(screen.queryByRole("button", { name: "Good answer" })).toBeNull();
    });
});

describe.each(SURFACES)("$name: a failed answer", (surface) => {
    it("shows the error, offers Ask again, and has no copy, thumbs or timing", () => {
        surface.mount({ turns: [{ ...ERROR_TURN, elapsedMs: 900 }] });
        expect(screen.getByText(/stub failure/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Ask again" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Copy answer" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Good answer" })).toBeNull();
        expect(screen.queryByText(/Answered in/)).toBeNull();
    });
});

describe.each(SURFACES)("$name: a write waiting for approval", (surface) => {
    const waiting = liveAsk({
        isStreaming: true,
        answer: "I can mark it done.",
        pendingApproval: PENDING,
    });

    it("shows the approval card and wires Approve and Reject", () => {
        const h = surface.mount({ turns: [TURN_ONE], ask: waiting });
        expect(screen.getByText(/Approval required/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        expect(h.approve).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Reject" }));
        expect(h.reject).toHaveBeenCalledTimes(1);
    });

    it("keeps the in-flight answer text next to the card", () => {
        surface.mount({ turns: [], ask: waiting });
        expect(screen.getByText(/I can mark it done\./)).toBeTruthy();
    });
});

describe.each(SURFACES)("$name: an answer still streaming", (surface) => {
    it("shows the streamed text and no thumbs or timing yet", () => {
        surface.mount({
            turns: [],
            ask: liveAsk({
                isStreaming: true,
                answer: "Partial answer so far",
                runId: "run-live",
                elapsedMs: 5,
            }),
        });
        expect(screen.getByText(/Partial answer so far/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Good answer" })).toBeNull();
        expect(screen.queryByText(/Answered in/)).toBeNull();
    });

    it("says it is thinking before any text or tool step has arrived", () => {
        surface.mount({ turns: [], ask: liveAsk({ isStreaming: true }) });
        expect(screen.getByText("Thinking…")).toBeTruthy();
    });
});

describe("citation sources: Spotlight resolves per turn, the Ask modals across the conversation", () => {
    // The pin the refactor must keep. The asks aggregate every turn's sources
    // on purpose (see AgentQAConversation's header comment), because the
    // server replays earlier answers into the prompt and the model re-cites.
    // Spotlight never did, and still does not: a refactor, not a behaviour
    // change. Turn 2 here retrieved nothing and cites turn 1's task.
    it.each([threadAsk, noteAsk])(
        "$name: turn 2's link to a turn-1 source still opens it",
        (s) => {
            const h = s.mount({ turns: [TURN_ONE, TURN_TWO] });
            const turnTwo = screen.getByText(/As before,/).closest("p, div") as HTMLElement;
            fireEvent.click(within(turnTwo).getByRole("button", { name: "the fix" }));
            expect(h.openSource).toHaveBeenCalledWith(TASK);
        }
    );

    it("Spotlight: turn 2's link degrades to plain prose, not a dead button", () => {
        spotlight.mount({ turns: [TURN_ONE, TURN_TWO] });
        const turnTwo = screen.getByText(/As before,/).closest("p, div") as HTMLElement;
        expect(within(turnTwo).queryByRole("button", { name: "the fix" })).toBeNull();
        expect(turnTwo.textContent).toContain("the fix");
    });
});

describe("one turn, one rendering", () => {
    // The turn is a single component now, so the same finished turn must read
    // identically wherever it is hosted: same words, same buttons, same order.
    const turnOf = (): HTMLElement =>
        screen.getByText(/What shipped last week\?/).parentElement!.parentElement!;

    const snapshot = () => {
        const root = turnOf();
        return {
            text: root.textContent,
            buttons: within(root)
                .getAllByRole("button")
                .map((b) => {
                    // A chip's name comes from the label it points at.
                    const labelledBy = b.getAttribute("aria-labelledby");
                    return (
                        b.getAttribute("aria-label") ??
                        (labelledBy ? document.getElementById(labelledBy)?.textContent : null) ??
                        b.textContent
                    );
                }),
        };
    };

    // Cites a task, a milestone and a bare-token task: every chip word here is
    // the same on every host. (A personal note is the one place they differ, below.)
    const SAME_EVERYWHERE: CompletedTurn = {
        ...TURN_ONE,
        answer: "Shipped in [the fix](task:12) last week. See [milestone:9].",
        answerSources: [TASK, MILESTONE, UNCITED],
    };

    it("is the same in Spotlight and in the thread and note Ask modals", () => {
        const seen = SURFACES.map((surface) => {
            surface.mount({ turns: [SAME_EVERYWHERE] });
            const out = snapshot();
            cleanup();
            return out;
        });
        expect(seen[1]).toEqual(seen[0]);
        expect(seen[2]).toEqual(seen[0]);
        // And it is the full turn, not an empty match.
        expect(seen[0].buttons).toEqual([
            "the fix",
            "Task PRJ-12: Fix login redirect",
            "Milestone: Beta launch",
            "Good answer",
            "Needs work",
            "Copy answer",
            "Ask again",
        ]);
    });

    it("differs in one word only: the Ask modals do not call a personal note 'My note'", () => {
        // Spotlight is handed which space each note lives in; the modals are not
        // (yet), and a team note called "My note" would be wrong, so they say "Note".
        const names = SURFACES.map((surface) => {
            surface.mount({ turns: [TURN_ONE] });
            const out = snapshot().buttons.filter((b) => /Release notes/.test(b ?? ""));
            cleanup();
            return out;
        });
        expect(names[0]).toEqual(["My note: Release notes"]);
        expect(names[1]).toEqual(["Note: Release notes"]);
        expect(names[2]).toEqual(["Note: Release notes"]);
    });
});
