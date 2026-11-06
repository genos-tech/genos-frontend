/**
 * "Save as note" and "Save as task" on every host of the answer turn: the Spotlight
 * overlay, the Genos page (`SpotlightContent`), the thread Ask modal and the note Ask
 * modal. One `AgentTurn`, one store: each host only has to hand it the two stable render
 * functions, and this checks that each one does, for a finished turn, and that it offers
 * neither on a turn that failed or has no run.
 *
 * Plus the wiring guard: every `<AgentTurn` a host mounts passes both functions.
 */

import { readFileSync } from "node:fs";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { AskState, CompletedTurn, UseAgentQAReturn } from "../features/agentQA";
import { resetSaveStore } from "../features/agentQA/saveAnswer/saveAnswerStore";
import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { NoteAskModal } from "../features/noteAsk/NoteAskModal";
import type { UseNoteAskReturn } from "../features/noteAsk/useNoteAsk";
import { SpotlightContent } from "../features/spotlight/SpotlightContent";
import { SpotlightOverlay } from "../features/spotlight/SpotlightOverlay";
import { ThreadAskModal } from "../features/threadAsk/ThreadAskModal";
import type { UseThreadAskReturn } from "../features/threadAsk/useThreadAsk";

vi.mock("../features/agentQA", async () => {
    const actual =
        await vi.importActual<typeof import("../features/agentQA")>("../features/agentQA");
    return { ...actual, AgentQAInput: () => <div data-testid="qa-input" /> };
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
const post = vi.fn();
vi.mock("../services/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/api")>();
    return { ...actual, authApi: () => ({ post: (...a: unknown[]) => post(...a) }) };
});

type Spy = Mock<(...args: unknown[]) => unknown>;
interface Handlers {
    undo: Spy;
    preview: Spy;
}
const newHandlers = (): Handlers => ({ undo: vi.fn(), preview: vi.fn() });

const RUN = "run-save-1";
const finished = (over: Partial<CompletedTurn> = {}): CompletedTurn => ({
    id: 1,
    askedQuery: "What shipped?",
    answer: "Shipped the fix.",
    answerSources: [],
    toolEvents: [],
    askError: null,
    runId: RUN,
    ...over,
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
        onPreview: h.preview,
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
beforeAll(() => {
    // jsdom has no `scrollTo`; Spotlight's follow-the-answer effect calls it.
    Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});
beforeEach(() => {
    resetSaveStore();
    localStorage.clear();
    localStorage.setItem("teamId", "t1");
    localStorage.setItem("userId", "u1");
    post.mockResolvedValue({ data: { noteId: 31 } });
});
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe.each(SURFACES)("$name: Save as note / task", (surface) => {
    it("offers both on a finished answer", () => {
        surface.mount([finished()]);
        expect(screen.getByRole("button", { name: "Save as note" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Save as task" })).toBeTruthy();
    });

    it("offers neither on a failed turn, a turn with no text, or one cancelled before done", () => {
        surface.mount([
            finished({ id: 1, askError: "boom" }),
            finished({ id: 2, answer: "" }),
            finished({ id: 3, runId: null }),
        ]);
        expect(screen.queryByRole("button", { name: "Save as note" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Save as task" })).toBeNull();
    });

    it("saves the note and keeps the result on screen", async () => {
        surface.mount([finished()]);
        fireEvent.click(screen.getByRole("button", { name: "Save as note" }));
        expect(await screen.findByText("Saved to My Notes")).toBeTruthy();
        expect(post).toHaveBeenCalledTimes(1);
        expect(post.mock.calls[0][0]).toBe("/note/personal/");
    });
});

describe.each([spotlightOverlay, spotlightPage])("$name: Open", (surface) => {
    it("hands the new note to the host's own source click", async () => {
        const h = surface.mount([finished()]);
        fireEvent.click(screen.getByRole("button", { name: "Save as note" }));
        await screen.findByText("Saved to My Notes");
        fireEvent.click(screen.getByRole("button", { name: "Open" }));
        expect(h.preview).toHaveBeenCalledWith(
            expect.objectContaining({ entity_type: "note", note_id: "31", note_type: "personal" })
        );
    });
});

describe("every host wires both render functions into every turn it mounts", () => {
    it.each([
        "src/features/agentQA/AgentQAConversation.tsx",
        "src/features/spotlight/SpotlightContent.tsx",
    ])("%s", (file) => {
        const text = readFileSync(file, "utf8");
        const mounts = (text.match(/<AgentTurn\s*\n/g) ?? []).length;
        expect(mounts).toBeGreaterThan(0);
        expect((text.match(/renderExtraActions=\{renderSaveAnswerActions\}/g) ?? []).length).toBe(
            mounts
        );
        expect((text.match(/renderAnswerStatus=\{renderSaveAnswerStatus\}/g) ?? []).length).toBe(
            mounts
        );
    });
});
