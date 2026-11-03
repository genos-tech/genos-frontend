/**
 * Render budget of the answer turn.
 *
 * The turn parses markdown, so re-rendering a finished answer is the expensive
 * thing to get wrong: a streamed `answer_delta` must re-render only the
 * in-flight turn, and typing (or any App-root write that hands the host a new
 * callback identity) must re-render no finished turn at all.
 *
 * `react-markdown` is replaced by a counting pass-through. Each turn has a
 * distinct answer text, and the library receives exactly that text, so the
 * number of calls with a given text is the number of times THAT turn was
 * rendered (all of its re-renders reach the parser, nothing else does).
 *
 * Measured on origin/main BEFORE the single-turn refactor (0b59b6c5), parser
 * calls for one finished turn (and for the in-flight one) in each scenario:
 *
 *   scenario                                   Spotlight          Ask modals
 *   30 streamed deltas                         0 (live 30)        0 (live 30)
 *   5 query writes / new callback identities   5 each (live 5)    0 (live 5)
 *   stream starts and ends (askDisabled flips) 3 each (live 3)    0 (live 3)
 *   5 keystrokes in the draft                  0                  n/a
 *
 * The single turn brings every "5" and "3" to 0: its callbacks sit behind refs
 * and the markdown parse has its own memo boundary. The streaming rows were
 * already at the floor, and must stay there.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AskState, CompletedTurn, UseAgentQAReturn } from "../features/agentQA";
import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { NoteAskModal } from "../features/noteAsk/NoteAskModal";
import type { UseNoteAskReturn } from "../features/noteAsk/useNoteAsk";
import { SpotlightContent } from "../features/spotlight/SpotlightContent";
import { ThreadAskModal } from "../features/threadAsk/ThreadAskModal";
import type { UseThreadAskReturn } from "../features/threadAsk/useThreadAsk";

const parsed = vi.hoisted(() => ({ texts: [] as string[], turns: [] as string[] }));

vi.mock("react-markdown", async () => {
    const actual = await vi.importActual<typeof import("react-markdown")>("react-markdown");
    const Counting = (props: React.ComponentProps<typeof actual.default>) => {
        parsed.texts.push(String(props.children));
        return <actual.default {...props} />;
    };
    return { ...actual, default: Counting };
});

// A second probe, one level up: the tool-step strip is rendered by every turn
// on every render of that turn (it is not memoised), so one call per turn
// render. This is what notices a turn losing its `memo`, which the parser
// count alone cannot (the markdown has its own memo boundary).
vi.mock("../features/agentQA/ToolProgressList", async () => {
    const actual = await vi.importActual<typeof import("../features/agentQA/ToolProgressList")>(
        "../features/agentQA/ToolProgressList"
    );
    return {
        ...actual,
        ToolProgressList: (props: React.ComponentProps<typeof actual.ToolProgressList>) => {
            parsed.turns.push(props.events[0]?.summary ?? "");
            return <actual.ToolProgressList {...props} />;
        },
    };
});

vi.mock("../features/agentQA", async () => {
    const actual =
        await vi.importActual<typeof import("../features/agentQA")>("../features/agentQA");
    return { ...actual, AgentQAInput: () => <div data-testid="qa-input" /> };
});

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

const turn = (id: number, answer: string): CompletedTurn => ({
    id,
    askedQuery: `Question ${id}`,
    answer,
    answerSources: [],
    // One step each, tagged, so a render of THIS turn can be told from another's.
    toolEvents: [
        {
            step: 1,
            tool_name: "search_workspace",
            arguments: {},
            status: "done",
            summary: `turn-${id}`,
        },
    ],
    askError: null,
    runId: `run-${id}`,
});

const ONE = "First finished answer.";
const TWO = "Second finished answer.";
const TURNS = [turn(1, ONE), turn(2, TWO)];

const live = (n: number): AskState => ({
    ...EMPTY_ASK_STATE,
    isStreaming: true,
    askedQuery: "Question 3",
    answer: `live ${"word ".repeat(n)}`,
    toolEvents: [
        {
            step: 1,
            tool_name: "search_workspace",
            arguments: {},
            status: "done",
            summary: "turn-live",
        },
    ],
});

// How many times the parser saw each kind of turn since `since`.
const mark = () => ({ t: parsed.texts.length, r: parsed.turns.length });
type Mark = ReturnType<typeof mark>;

const countsSince = (since: Mark) => {
    const slice = parsed.texts.slice(since.t);
    return {
        one: slice.filter((t) => t === ONE).length,
        two: slice.filter((t) => t === TWO).length,
        live: slice.filter((t) => t.startsWith("live ")).length,
    };
};

// How many times each turn itself rendered since `since`.
const rendersSince = (since: Mark) => {
    const slice = parsed.turns.slice(since.r);
    return {
        one: slice.filter((t) => t === "turn-1").length,
        two: slice.filter((t) => t === "turn-2").length,
        live: slice.filter((t) => t === "turn-live").length,
    };
};

beforeEach(() => {
    parsed.texts.length = 0;
    parsed.turns.length = 0;
    localStorage.clear();
});

// ---------------------------------------------------------------------------
// Spotlight / the Genos page
// ---------------------------------------------------------------------------

const noop = () => {};

const spotlightProps = (over: {
    ask: AskState;
    query?: string;
    onAsk?: (...args: unknown[]) => void;
    onPreview?: (...args: unknown[]) => void;
}) => ({
    aiAnswersEnabled: true,
    ask: over.ask,
    backToHistoryList: noop,
    closeHistory: noop,
    error: null,
    filterServices: [],
    historyDetail: null,
    historyIsLoading: false,
    historyLoadFailed: false,
    historyMode: "closed" as const,
    historySessions: [],
    isLoading: false,
    openHistory: noop,
    query: over.query ?? "",
    results: [],
    turns: TURNS,
    variant: "page" as const,
    viewHistorySession: noop,
    onApprove: noop,
    onAsk: over.onAsk ?? noop,
    onCancel: noop,
    onFeedback: noop,
    onNewConversation: noop,
    onOpenSettings: noop,
    onPreview: over.onPreview ?? noop,
    onQueryChange: noop,
    onReject: noop,
    onSelect: noop,
    onToggleFilterService: noop,
});

const SpotlightHost = (props: Parameters<typeof spotlightProps>[0]) => (
    <CssVarsProvider>
        <SpotlightContent {...spotlightProps(props)} />
    </CssVarsProvider>
);

describe("Spotlight: a streamed answer", () => {
    it("re-renders only the in-flight turn, once per delta", () => {
        const view = render(<SpotlightHost ask={live(0)} />);
        expect(countsSince({ t: 0, r: 0 })).toMatchObject({ one: 1, two: 1 });
        const before = mark();
        for (let i = 1; i <= 30; i += 1) view.rerender(<SpotlightHost ask={live(i)} />);
        expect(countsSince(before)).toEqual({ one: 0, two: 0, live: 30 });
        // And the turn components themselves: only the in-flight one rendered.
        expect(rendersSince(before)).toEqual({ one: 0, two: 0, live: 30 });
    }, 30_000);
});

describe("Spotlight: the draft and the App-root query write", () => {
    it("typing in the box re-renders no turn", () => {
        const ask = live(1);
        render(<SpotlightHost ask={ask} />);
        const before = mark();
        const box = screen.getByRole("textbox");
        for (const value of ["w", "wh", "wha", "what", "what is"]) {
            fireEvent.change(box, { target: { value } });
        }
        expect(countsSince(before)).toEqual({ one: 0, two: 0, live: 0 });
        expect(rendersSince(before)).toEqual({ one: 0, two: 0, live: 0 });
    });

    it("a new App-root `query` and a new `onAsk` identity re-render no finished turn", () => {
        // The real hook re-mints `onAsk` whenever `query` changes (it reads the
        // draft). The overlay debounces that write to ~one per pause, but each
        // one used to reach every finished turn through TurnView's `onAsk`.
        // The conversation itself is the same object throughout, as the hook's is.
        const ask = live(1);
        const view = render(<SpotlightHost ask={ask} query="" onAsk={() => {}} />);
        const before = mark();
        for (const q of ["a", "ab", "abc", "abcd", "abcde"]) {
            view.rerender(<SpotlightHost ask={ask} query={q} onAsk={() => {}} />);
        }
        // origin/main: 5 and 5 (and the live turn 5), one per identity change:
        // the callback was handed straight to the memoised turn.
        expect(countsSince(before)).toEqual({ one: 0, two: 0, live: 0 });
        expect(rendersSince(before)).toEqual({ one: 0, two: 0, live: 0 });
    });

    it("a stream starting and ending re-parses no turn", () => {
        // `askDisabled` flips on every finished turn at each end. origin/main:
        // 3 parses of each finished turn across off, on, off.
        const view = render(<SpotlightHost ask={{ ...live(5), isStreaming: false }} />);
        const before = mark();
        view.rerender(<SpotlightHost ask={{ ...live(5), isStreaming: true }} />);
        view.rerender(<SpotlightHost ask={{ ...live(5), isStreaming: false }} />);
        view.rerender(<SpotlightHost ask={{ ...live(5), isStreaming: true }} />);
        expect(countsSince(before)).toEqual({ one: 0, two: 0, live: 0 });
        // The turns' shells do render (Ask again is disabled while busy, so it
        // is a prop), as on origin/main: 3 each. Only the markdown is spared.
        expect(rendersSince(before)).toEqual({ one: 3, two: 3, live: 3 });
    });
});

// ---------------------------------------------------------------------------
// Thread and note Ask modals
// ---------------------------------------------------------------------------

const agentQAState = (ask: AskState, over: Partial<UseAgentQAReturn> = {}) =>
    ({
        query: "",
        setQuery: noop,
        ask,
        turns: TURNS,
        sessionId: "sess-1",
        onAsk: noop,
        onCancel: noop,
        onApprove: noop,
        onReject: noop,
        clearConversation: noop,
        reset: noop,
        submitFeedback: noop,
        ...over,
    }) as unknown as UseAgentQAReturn;

const threadState = (agentQA: UseAgentQAReturn) =>
    ({
        isOpen: true,
        open: noop,
        close: noop,
        threadContext: { chatType: 2, chatId: 77, threadId: 404 },
        summary: {
            text: "Ten messages about the launch.",
            lastUpdatedIso: "2026-07-29T09:00:00Z",
            fingerprint: "fp-1",
            messageCount: 10,
        },
        summaryLoading: false,
        summaryError: null,
        refreshSummary: noop,
        staleSummary: false,
        agentQA,
    }) as unknown as UseThreadAskReturn;

const noteState = (agentQA: UseAgentQAReturn) =>
    ({
        isOpen: true,
        open: noop,
        close: noop,
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
        refreshSummary: noop,
        staleSummary: false,
        agentQA,
    }) as unknown as UseNoteAskReturn;

const ThreadHost = (props: {
    agentQA: UseAgentQAReturn;
    onSelectSource?: (...args: unknown[]) => void;
}) => (
    <CssVarsProvider>
        <ThreadAskModal
            accessToken="tok"
            chatName="Launch"
            myself={{ userId: "u1", teamId: "t1" } as never}
            state={threadState(props.agentQA)}
            onSelectSource={props.onSelectSource}
        />
    </CssVarsProvider>
);

const NoteHost = (props: {
    agentQA: UseAgentQAReturn;
    onSelectSource?: (...args: unknown[]) => void;
}) => (
    <CssVarsProvider>
        <NoteAskModal state={noteState(props.agentQA)} onSelectSource={props.onSelectSource} />
    </CssVarsProvider>
);

describe.each([
    ["ThreadAskModal", ThreadHost],
    ["NoteAskModal", NoteHost],
] as const)("%s", (_name, Host) => {
    it("a streamed answer re-renders only the in-flight turn, once per delta", () => {
        const view = render(<Host agentQA={agentQAState(live(0))} />);
        expect(countsSince({ t: 0, r: 0 })).toMatchObject({ one: 1, two: 1 });
        const before = mark();
        for (let i = 1; i <= 30; i += 1) {
            view.rerender(<Host agentQA={agentQAState(live(i))} />);
        }
        expect(countsSince(before)).toEqual({ one: 0, two: 0, live: 30 });
    }, 30_000);

    it("a new `onAsk` and an inline `onSelectSource` re-render no finished turn", () => {
        // `onAsk` re-mints per keystroke (it closes over the live query) and a
        // host's `onSelectSource` is often an inline lambda.
        const ask = live(1);
        const view = render(
            <Host agentQA={agentQAState(ask, { onAsk: () => true })} onSelectSource={() => {}} />
        );
        const before = mark();
        for (let i = 0; i < 5; i += 1) {
            view.rerender(
                <Host
                    agentQA={agentQAState(ask, { onAsk: () => true, query: "q".repeat(i) })}
                    onSelectSource={() => {}}
                />
            );
        }
        // origin/main: the in-flight turn re-parsed on every one of these (5).
        expect(countsSince(before)).toEqual({ one: 0, two: 0, live: 0 });
        expect(rendersSince(before)).toEqual({ one: 0, two: 0, live: 0 });
    });

    it("a stream starting and ending re-parses no turn", () => {
        const view = render(<Host agentQA={agentQAState({ ...live(5), isStreaming: false })} />);
        const before = mark();
        view.rerender(<Host agentQA={agentQAState({ ...live(5), isStreaming: true })} />);
        view.rerender(<Host agentQA={agentQAState({ ...live(5), isStreaming: false })} />);
        view.rerender(<Host agentQA={agentQAState({ ...live(5), isStreaming: true })} />);
        expect(countsSince(before)).toEqual({ one: 0, two: 0, live: 0 });
        // The modals never disabled Ask again while busy (the hook refuses the
        // ask anyway), so finished turns stay untouched, as on origin/main; the
        // in-flight turn renders for each flip, as it did.
        expect(rendersSince(before)).toEqual({ one: 0, two: 0, live: 3 });
    });
});
