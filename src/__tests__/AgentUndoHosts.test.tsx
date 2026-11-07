/**
 * Undo on every host of the answer turn: the Spotlight overlay, the Genos page
 * (`SpotlightContent`), the thread Ask modal and the note Ask modal. One
 * `AgentTurn`, one store: each host only has to hand it `onUndo`, and this checks
 * that each one does, for a finished turn that was restored (it has no tool events,
 * only the server's list) and for one that carries its tool events.
 *
 * Plus the render budget at the host: a host re-rendering with fresh callback
 * identities (what typing does) re-renders no turn.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { AskState, CompletedTurn, UseAgentQAReturn } from "../features/agentQA";
import { AgentQAConversation } from "../features/agentQA/AgentQAConversation";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import type { UndoRequest, UndoStepRef } from "../features/agentQA/undoSteps";
import { resetUndoStore, runUndo } from "../features/agentQA/undoStore";
import { NoteAskModal } from "../features/noteAsk/NoteAskModal";
import type { UseNoteAskReturn } from "../features/noteAsk/useNoteAsk";
import { SpotlightContent } from "../features/spotlight/SpotlightContent";
import { SpotlightOverlay } from "../features/spotlight/SpotlightOverlay";
import { ThreadAskModal } from "../features/threadAsk/ThreadAskModal";
import type { UseThreadAskReturn } from "../features/threadAsk/useThreadAsk";
import { getMessages } from "../i18n";

const counts = vi.hoisted(() => ({ turns: [] as string[] }));

vi.mock("../features/agentQA", async () => {
    const actual =
        await vi.importActual<typeof import("../features/agentQA")>("../features/agentQA");
    return { ...actual, AgentQAInput: () => <div data-testid="qa-input" /> };
});
vi.mock("../features/agentQA/ToolProgressList", async () => {
    const actual = await vi.importActual<typeof import("../features/agentQA/ToolProgressList")>(
        "../features/agentQA/ToolProgressList"
    );
    return {
        ...actual,
        ToolProgressList: (props: React.ComponentProps<typeof actual.ToolProgressList>) => {
            counts.turns.push(props.events[0]?.summary ?? "");
            return <actual.ToolProgressList {...props} />;
        },
    };
});
vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));
vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        askAgentStream: vi.fn(async () => {}),
        decideAgent: vi.fn(async () => {}),
        fetchAgentSessionDetail: vi.fn(async () => null),
        fetchAgentSessions: vi.fn(async () => []),
        submitAgentFeedback: vi.fn(async () => true),
    };
});
vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const RUN = "run-77";
const FAR = new Date(Date.now() + 5 * 86_400_000).toISOString();

const step = (stepId: number, n: number, tool: string): UndoStepRef => ({
    stepId,
    step: n,
    toolName: tool,
    runId: RUN,
    availableUntil: FAR,
    undoneAt: null,
});

// A turn restored from the server: no tool events, only the list.
const restored = (undo: UndoStepRef[] = [step(4711, 2, "create_task")]): CompletedTurn => ({
    id: 1,
    askedQuery: "Make a task",
    answer: "I made it.",
    answerSources: [],
    toolEvents: [],
    askError: null,
    runId: RUN,
    undo,
});

// A finished turn that still has the events it streamed with.
const live = (): CompletedTurn => ({
    id: 2,
    askedQuery: "Comment on it",
    answer: "Commented.",
    answerSources: [],
    toolEvents: [
        {
            step: 3,
            tool_name: "add_comment",
            arguments: {},
            status: "done",
            summary: "live-turn",
            undo: { step_id: 4720, available_until: FAR, run_id: RUN },
        },
    ],
    askError: null,
    runId: RUN,
});

type Spy = Mock<(...args: unknown[]) => unknown>;
interface Handlers {
    undo: Spy;
}
const newHandlers = (): Handlers => ({
    undo: vi.fn((r: unknown) => void runUndo({ ...(r as UndoRequest), accessToken: "t" })),
});

const agentQAState = (turns: CompletedTurn[], h: Handlers, ask: AskState = EMPTY_ASK_STATE) =>
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
        undoStep: h.undo,
    }) as unknown as UseAgentQAReturn;

const spotlightProps = (turns: CompletedTurn[], h: Handlers, over: Record<string, unknown> = {}) =>
    ({
        ask: EMPTY_ASK_STATE,
        backToHistoryList: vi.fn(),
        closeHistory: vi.fn(),
        error: null,
        filterServices: [],
        historyDetail: null,
        historyIsLoading: false,
        historyLoadFailed: false,
        historyMode: "closed",
        historySessions: [],
        isLoading: false,
        openHistory: vi.fn(),
        query: "",
        results: [],
        turns,
        viewHistorySession: vi.fn(),
        aiAnswersEnabled: true,
        onApprove: vi.fn(),
        onAsk: vi.fn(),
        onCancel: vi.fn(),
        onFeedback: vi.fn(),
        onNewConversation: vi.fn(),
        onOpenSettings: vi.fn(),
        onPreview: vi.fn(),
        onQueryChange: vi.fn(),
        onReject: vi.fn(),
        onSelect: vi.fn(),
        onToggleFilterService: vi.fn(),
        onUndo: h.undo,
        ...over,
    }) as never;

interface Surface {
    name: string;
    mount: (turns: CompletedTurn[]) => Handlers;
}

const spotlightOverlay: Surface = {
    name: "Spotlight overlay",
    mount: (turns) => {
        const h = newHandlers();
        render(
            <CssVarsProvider>
                <SpotlightOverlay isOpen onClose={vi.fn()} {...spotlightProps(turns, h)} />
            </CssVarsProvider>
        );
        return h;
    },
};
const spotlightPage: Surface = {
    name: "Spotlight (Genos page)",
    mount: (turns) => {
        const h = newHandlers();
        render(
            <CssVarsProvider>
                <SpotlightContent {...spotlightProps(turns, h, { variant: "page" })} />
            </CssVarsProvider>
        );
        return h;
    },
};
const threadAsk: Surface = {
    name: "ThreadAskModal",
    mount: (turns) => {
        const h = newHandlers();
        const state = {
            isOpen: true,
            open: vi.fn(),
            close: vi.fn(),
            threadContext: { chatType: 2, chatId: 77, threadId: 404 },
            summary: {
                text: "Ten messages.",
                lastUpdatedIso: "2026-07-29T09:00:00Z",
                fingerprint: "fp-1",
                messageCount: 10,
            },
            summaryLoading: false,
            summaryError: null,
            refreshSummary: vi.fn(),
            staleSummary: false,
            agentQA: agentQAState(turns, h),
        } as unknown as UseThreadAskReturn;
        render(
            <CssVarsProvider>
                <ThreadAskModal
                    accessToken="tok"
                    chatName="Launch"
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    state={state}
                />
            </CssVarsProvider>
        );
        return h;
    },
};
const noteAsk: Surface = {
    name: "NoteAskModal",
    mount: (turns) => {
        const h = newHandlers();
        const state = {
            isOpen: true,
            open: vi.fn(),
            close: vi.fn(),
            noteContext: { noteType: 1, noteId: 5 },
            summary: {
                text: "A note.",
                lastUpdatedIso: "2026-07-29T09:00:00Z",
                fingerprint: "fp-1",
                bodyLength: 120,
                noteTitle: "Launch",
            },
            summaryLoading: false,
            summaryError: null,
            refreshSummary: vi.fn(),
            staleSummary: false,
            agentQA: agentQAState(turns, h),
        } as unknown as UseNoteAskReturn;
        render(
            <CssVarsProvider>
                <NoteAskModal state={state} />
            </CssVarsProvider>
        );
        return h;
    },
};

const SURFACES = [spotlightOverlay, spotlightPage, threadAsk, noteAsk];

// -------- a scripted server --------
const requests: string[] = [];
let answerNext: (() => void) | null = null;
beforeAll(() => {
    // jsdom has no `scrollTo`; Spotlight's follow-the-answer effect calls it.
    Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});
beforeEach(() => {
    resetUndoStore();
    requests.length = 0;
    counts.turns.length = 0;
    localStorage.clear();
    vi.stubGlobal(
        "fetch",
        vi.fn(
            (url: string) =>
                new Promise<Response>((resolve) => {
                    requests.push(url);
                    answerNext = () =>
                        resolve({
                            ok: true,
                            status: 200,
                            json: async () => ({
                                run_id: RUN,
                                step_id: 4711,
                                tool_name: "create_task",
                                undone_at: "2026-11-04T00:00:00Z",
                                action: "deleted",
                                restored: [],
                                skipped: [],
                                entity: {
                                    kind: "task",
                                    task_id: 1,
                                    project_id: 2,
                                    display_id: "PRJ-1",
                                },
                                summary: "x",
                            }),
                        } as unknown as Response);
                })
        )
    );
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe.each(SURFACES)("$name: Undo", (surface) => {
    it("offers Undo on a restored turn (it has only the server's list, no tool events)", () => {
        surface.mount([restored()]);
        expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it("offers it on a finished turn that carries its tool events", () => {
        surface.mount([live()]);
        expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it("offers none on a turn with nothing to undo", () => {
        surface.mount([{ ...restored(), undo: undefined }]);
        expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    });

    it("a click reaches the host's callback with the run and the step, and sends one request", async () => {
        const h = surface.mount([restored()]);
        const undo = screen.getByRole("button", { name: "Undo" });
        fireEvent.click(undo);
        fireEvent.click(undo);
        expect(h.undo).toHaveBeenCalledWith({
            runId: RUN,
            stepId: 4711,
            toolName: "create_task",
        });
        expect(requests).toHaveLength(1);
        expect(requests[0].endsWith(`/agent/runs/${RUN}/steps/4711/undo/`)).toBe(true);
        await act(async () => {
            answerNext?.();
            await new Promise((r) => setTimeout(r, 0));
        });
        expect(screen.getByRole("status").textContent).toContain("Task PRJ-1 was deleted.");
    });

    it("two writes in one restored turn: newest first", () => {
        surface.mount([restored([step(4711, 1, "create_task"), step(4712, 3, "add_comment")])]);
        const controls = screen.getAllByTestId("undo-control");
        expect(controls.map((c) => c.getAttribute("data-step-id"))).toEqual(["4712", "4711"]);
    });

    it("is not inside the hover-revealed action bar", () => {
        surface.mount([restored()]);
        expect(screen.getByRole("button", { name: "Undo" }).closest(".turn-actions")).toBeNull();
    });
});

describe("the same conversation in the overlay AND on the page", () => {
    it("shares one state: one request, and the other copy follows", async () => {
        const h = newHandlers();
        const turns = [restored()];
        render(
            <CssVarsProvider>
                <div data-testid="overlay">
                    <SpotlightOverlay isOpen onClose={vi.fn()} {...spotlightProps(turns, h)} />
                </div>
                <div data-testid="page">
                    <SpotlightContent {...spotlightProps(turns, h, { variant: "page" })} />
                </div>
            </CssVarsProvider>
        );
        expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(2);
        fireEvent.click(
            within(screen.getByTestId("overlay")).getByRole("button", { name: "Undo" })
        );
        expect(screen.queryAllByRole("button", { name: "Undo" })).toHaveLength(0);
        expect(screen.getAllByRole("button", { name: /Undoing/ })).toHaveLength(2);
        await act(async () => {
            answerNext?.();
            await new Promise((r) => setTimeout(r, 0));
        });
        expect(screen.getAllByRole("status")).toHaveLength(2);
        expect(requests).toHaveLength(1);
    });
});

describe("render budget at the host", () => {
    // Memoised on `t`, as every host does: a new object per render would defeat the memo.
    const turnLabels = buildAgentTurnLabels(getMessages("en"), "threadAsk");
    const conversation = (state: UseAgentQAReturn) => (
        <CssVarsProvider>
            <AgentQAConversation
                state={state}
                turnLabels={turnLabels}
                labels={{
                    conversation: { empty: "", placeholder: "", send: "", cancel: "" },
                    mentions: { ariaLabel: "" },
                }}
            />
        </CssVarsProvider>
    );
    const withEvents = (n: number): CompletedTurn => ({
        ...live(),
        id: n,
        toolEvents: [
            {
                ...live().toolEvents[0],
                summary: `turn-${n}`,
                undo: { step_id: 4800 + n, available_until: FAR, run_id: RUN },
            },
        ],
    });

    it("thread/note Ask: a host re-rendering with FRESH callback identities re-renders no turn", () => {
        const turns = [withEvents(1), withEvents(2)];
        const h = newHandlers();
        const mk = () => ({ ...agentQAState(turns, h), onAsk: vi.fn(), undoStep: vi.fn() });
        const { rerender } = render(conversation(mk()));
        const before = [...counts.turns];
        expect(before).toEqual(["turn-1", "turn-2"]);
        for (let i = 0; i < 5; i++) rerender(conversation(mk()));
        expect(counts.turns).toEqual(before);
    });

    it("Spotlight: typing (the host re-rendering with a new query) re-renders no turn", () => {
        const turns = [withEvents(1), withEvents(2)];
        const h = newHandlers();
        const props = spotlightProps(turns, h, { variant: "page" });
        const tree = (query: string) => (
            <CssVarsProvider>
                <SpotlightContent {...props} query={query} />
            </CssVarsProvider>
        );
        const { rerender } = render(tree(""));
        const before = [...counts.turns];
        expect(before).toEqual(["turn-1", "turn-2"]);
        for (const q of ["h", "he", "hel", "hell", "hello"]) rerender(tree(q));
        expect(counts.turns).toEqual(before);
    });
});
