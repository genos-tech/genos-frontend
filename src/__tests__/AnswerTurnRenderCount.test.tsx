/**
 * Render budget of the answer turn (MIP-904 follow-up).
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
 * The numbers pinned for "finished turns" were measured on origin/main BEFORE
 * the single-turn refactor (0b59b6c5) and the test is unchanged since: a
 * finished turn costs nothing while streaming or typing, on every host.
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

const parsed = vi.hoisted(() => ({ texts: [] as string[] }));

vi.mock("react-markdown", async () => {
    const actual = await vi.importActual<typeof import("react-markdown")>("react-markdown");
    const Counting = (props: React.ComponentProps<typeof actual.default>) => {
        parsed.texts.push(String(props.children));
        return <actual.default {...props} />;
    };
    return { ...actual, default: Counting };
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
    toolEvents: [],
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
});

// How many times the parser saw each kind of turn since `since`.
const countsSince = (since: number) => {
    const slice = parsed.texts.slice(since);
    return {
        one: slice.filter((t) => t === ONE).length,
        two: slice.filter((t) => t === TWO).length,
        live: slice.filter((t) => t.startsWith("live ")).length,
    };
};

beforeEach(() => {
    parsed.texts.length = 0;
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
        expect(countsSince(0)).toMatchObject({ one: 1, two: 1 });
        const before = parsed.texts.length;
        for (let i = 1; i <= 30; i += 1) view.rerender(<SpotlightHost ask={live(i)} />);
        expect(countsSince(before)).toEqual({ one: 0, two: 0, live: 30 });
    }, 30_000);
});

describe("Spotlight: the draft and the App-root query write", () => {
    it("typing in the box re-renders no turn", () => {
        render(<SpotlightHost ask={live(1)} />);
        const before = parsed.texts.length;
        const box = screen.getByRole("textbox");
        for (const value of ["w", "wh", "wha", "what", "what is"]) {
            fireEvent.change(box, { target: { value } });
        }
        expect(countsSince(before)).toEqual({ one: 0, two: 0, live: 0 });
    });

    it("a new App-root `query` and a new `onAsk` identity re-render no finished turn", () => {
        // The real hook re-mints `onAsk` whenever `query` changes (it reads the
        // draft). The overlay debounces that write to ~one per pause, but each
        // one used to reach every finished turn through TurnView's `onAsk`.
        const view = render(<SpotlightHost ask={live(1)} query="" onAsk={() => {}} />);
        const before = parsed.texts.length;
        for (const q of ["a", "ab", "abc", "abcd", "abcde"]) {
            view.rerender(<SpotlightHost ask={live(1)} query={q} onAsk={() => {}} />);
        }
        const c = countsSince(before);
        // Measured on origin/main: 5 and 5, one per identity change (the
        // callback was handed straight to the memoised turn).
        expect(c.one).toBeLessThanOrEqual(5);
        expect(c.two).toBeLessThanOrEqual(5);
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
        expect(countsSince(0)).toMatchObject({ one: 1, two: 1 });
        const before = parsed.texts.length;
        for (let i = 1; i <= 30; i += 1) {
            view.rerender(<Host agentQA={agentQAState(live(i))} />);
        }
        expect(countsSince(before)).toEqual({ one: 0, two: 0, live: 30 });
    }, 30_000);

    it("a new `onAsk` and an inline `onSelectSource` re-render no finished turn", () => {
        // `onAsk` re-mints per keystroke (it closes over the live query) and a
        // host's `onSelectSource` is often an inline lambda.
        const view = render(
            <Host
                agentQA={agentQAState(live(1), { onAsk: () => true })}
                onSelectSource={() => {}}
            />
        );
        const before = parsed.texts.length;
        for (let i = 0; i < 5; i += 1) {
            view.rerender(
                <Host
                    agentQA={agentQAState(live(1), { onAsk: () => true, query: "q".repeat(i) })}
                    onSelectSource={() => {}}
                />
            );
        }
        expect(countsSince(before)).toMatchObject({ one: 0, two: 0 });
    });
});
