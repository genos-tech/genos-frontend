/**
 * The chips of a turn across an approval pause, on every host of the answer
 * turn (MIP-997), driven by the REAL `useAgentQA` (the stream handlers it hands
 * to `askAgentStream` / `decideAgent` are called the way the stream calls them).
 *
 * What the person sees is not the chip list but what the turn makes of it: an
 * inline citation of a source the list holds is a button, of one it does not it
 * is plain prose; a chip is shown for what the answer cites (and for what the
 * agent changed). So each check reads the screen.
 *
 *   - the thread Ask and the note Ask (`AgentQAConversation`), the Spotlight
 *     overlay and the Genos page (`SpotlightContent`): all four render the one
 *     `AgentTurn`;
 *   - the same conversation in TWO hosts at once (the overlay and the kept-alive
 *     Genos page share one `useSpotlight` at the App root), and two separate
 *     hook instances side by side (a thread modal and Spotlight): the merge keeps
 *     its state in the hook instance, none of it at module level;
 *   - the render budget: an event that adds nothing renders no turn, and one that
 *     adds a chip renders no more turns than it does on main.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentQA, type UseAgentQAReturn } from "../features/agentQA";
import { AgentQAConversation } from "../features/agentQA/AgentQAConversation";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import { NoteAskModal } from "../features/noteAsk/NoteAskModal";
import type { UseNoteAskReturn } from "../features/noteAsk/useNoteAsk";
import { SpotlightContent } from "../features/spotlight/SpotlightContent";
import { SpotlightOverlay } from "../features/spotlight/SpotlightOverlay";
import type { SpotlightResult } from "../features/spotlight/types";
import { ThreadAskModal } from "../features/threadAsk/ThreadAskModal";
import type { UseThreadAskReturn } from "../features/threadAsk/useThreadAsk";
import { getMessages } from "../i18n";
import { askAgentStream, decideAgent, type PendingApprovalPayload } from "../services/agentApi";

const counts = vi.hoisted(() => ({ turns: [] as string[] }));

vi.mock("../features/agentQA", async () => {
    const actual =
        await vi.importActual<typeof import("../features/agentQA")>("../features/agentQA");
    return { ...actual, AgentQAInput: () => <div data-testid="qa-input" /> };
});
// One call per render of a turn (the strip is not memoised), tagged by its first step.
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

type AskArgs = Parameters<typeof askAgentStream>[0];
type DecideArgs = Parameters<typeof decideAgent>[0];
const asks = (): AskArgs[] => vi.mocked(askAgentStream).mock.calls.map((c) => c[0]);
const decides = (): DecideArgs[] => vi.mocked(decideAgent).mock.calls.map((c) => c[0]);

const source = (
    entity_type: SpotlightResult["entity_type"],
    entity_id: string,
    over: Partial<SpotlightResult> = {}
): SpotlightResult => ({
    entity_type,
    entity_id,
    title: null,
    snippet: null,
    chat_type: null,
    chat_id: null,
    thread_id: null,
    message_id: null,
    task_id: null,
    task_display_id: null,
    note_id: null,
    note_type: null,
    project_id: null,
    matched_chunk_types: [],
    matched_terms: [],
    related_entity_ids: [],
    updated_at: null,
    score: 0,
    keyword_rank: null,
    vector_rank: null,
    ...over,
});

const THREAD = source("chat", "gm:9d3c:thread:4", {
    title: "Release thread",
    chat_type: "gm",
    chat_id: "9d3c",
    thread_id: "4",
});
const FOUND = source("task", "task:9", {
    title: "Fix login",
    task_id: "9",
    task_display_id: "PRJ-9",
});
const CREATED = source("task", "task:55", {
    title: "Ship the fix",
    task_id: "55",
    task_display_id: "PRJ-55",
    operated: true,
});

const PENDING: PendingApprovalPayload = {
    step: 2,
    tool_name: "create_task",
    arguments: {},
    approval_token: "tok-1",
    run_id: "run-p",
};

// What the model writes at the end: cites a source found BEFORE the pause, and
// the one the approved write created.
const ANSWER = "The cause was [the login redirect](task:9). I made [the follow-up](task:55).";

// -------- hosts --------
const turnLabels = buildAgentTurnLabels(getMessages("en"), "threadAsk");

const conversation = (state: UseAgentQAReturn) => (
    <AgentQAConversation
        state={state}
        turnLabels={turnLabels}
        labels={{
            conversation: { empty: "", placeholder: "", send: "", cancel: "" },
            mentions: { ariaLabel: "" },
        }}
    />
);

const spotlightProps = (qa: UseAgentQAReturn, over: Record<string, unknown> = {}) =>
    ({
        ask: qa.ask,
        turns: qa.turns,
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
        viewHistorySession: vi.fn(),
        aiAnswersEnabled: true,
        onApprove: qa.onApprove,
        onAsk: qa.onAsk,
        onCancel: qa.onCancel,
        onFeedback: vi.fn(),
        onNewConversation: vi.fn(),
        onOpenSettings: vi.fn(),
        onPreview: vi.fn(),
        onQueryChange: vi.fn(),
        onReject: qa.onReject,
        onSelect: vi.fn(),
        onToggleFilterService: vi.fn(),
        onUndo: qa.undoStep,
        ...over,
    }) as never;

const threadState = (qa: UseAgentQAReturn) =>
    ({
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
        agentQA: qa,
    }) as unknown as UseThreadAskReturn;

const noteState = (qa: UseAgentQAReturn) =>
    ({
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
        agentQA: qa,
    }) as unknown as UseNoteAskReturn;

interface Host {
    name: string;
    // How one conversation (the state of ONE hook) is drawn on this host.
    draw: (qa: UseAgentQAReturn) => React.ReactNode;
}
const THREAD_MODAL: Host = {
    name: "ThreadAskModal",
    draw: (qa) => (
        <ThreadAskModal
            accessToken="tok"
            chatName="Launch"
            myself={{ userId: "u1", teamId: "t1" } as never}
            state={threadState(qa)}
        />
    ),
};
const NOTE_MODAL: Host = {
    name: "NoteAskModal",
    draw: (qa) => <NoteAskModal state={noteState(qa)} />,
};
const OVERLAY: Host = {
    name: "Spotlight overlay",
    draw: (qa) => <SpotlightOverlay isOpen onClose={vi.fn()} {...spotlightProps(qa)} />,
};
const PAGE: Host = {
    name: "Spotlight (Genos page)",
    draw: (qa) => <SpotlightContent {...spotlightProps(qa, { variant: "page" })} />,
};
const CONVERSATION: Host = { name: "AgentQAConversation", draw: conversation };
const HOSTS = [THREAD_MODAL, NOTE_MODAL, OVERLAY, PAGE, CONVERSATION];

// A component that owns ONE hook and draws it on each of `hosts`, side by side.
let latest: UseAgentQAReturn;
const Conversation = ({ hosts }: { hosts: Host[] }) => {
    const qa = useAgentQA({ accessToken: "tok", teamId: "t1" });
    latest = qa;
    return (
        <>
            {hosts.map((h) => (
                <div key={h.name} data-testid={h.name}>
                    {h.draw(qa)}
                </div>
            ))}
        </>
    );
};
const mountOn = (hosts: Host[]) =>
    render(
        <CssVarsProvider>
            <Conversation hosts={hosts} />
        </CssVarsProvider>
    );

// -------- the script of a turn that pauses on a write and is decided --------
const start = (q = "why can't I log in?") => {
    act(() => {
        latest.onAsk(q);
    });
    return asks().at(-1)!;
};
// First leg: the thread was seeded, a search found task 9, then a write pauses.
const firstLeg = (first = start()) => {
    act(() => first.onSources([THREAD]));
    act(() => first.onSources([THREAD, FOUND]));
    act(() => first.onDelta("Let me make a follow-up. "));
    act(() => first.onPendingApproval?.(PENDING));
};
// Resumed leg, as the server sends it: the write's chip, then the same set re-ranked
// (cited first) before `done`, with the answer's text.
const resumedLeg = (decision: "approve" | "reject") => {
    act(() => (decision === "approve" ? latest.onApprove() : latest.onReject()));
    const resumed = decides().at(-1)!;
    if (decision === "approve") {
        act(() => resumed.onSources([CREATED]));
        act(() => resumed.onSources([CREATED]));
    }
    act(() => resumed.onDelta(ANSWER));
    act(() => resumed.onDone("sess-1", "run-p", 1200));
    return resumed;
};

beforeAll(() => {
    // jsdom has no `scrollTo`; Spotlight's follow-the-answer effect calls it.
    Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});
beforeEach(() => {
    counts.turns.length = 0;
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(askAgentStream).mockImplementation(async () => {});
    vi.mocked(decideAgent).mockImplementation(async () => {});
});
afterEach(cleanup);

describe.each(HOSTS)("$name: after an approve", (host) => {
    it("a source cited from before the pause is still a link, and still a chip", () => {
        mountOn([host]);
        firstLeg();
        resumedLeg("approve");
        // The inline citation of the source the FIRST leg found resolves...
        expect(screen.getByRole("button", { name: "the login redirect" })).toBeTruthy();
        // ...so does the one the approved write created...
        expect(screen.getByRole("button", { name: "the follow-up" })).toBeTruthy();
        // ...and both are chips (the chip button reads "Task PRJ-9: Fix login").
        expect(screen.getByRole("button", { name: /PRJ-9: Fix login/ })).toBeTruthy();
        expect(screen.getByRole("button", { name: /PRJ-55: Ship the fix/ })).toBeTruthy();
    });
});

describe.each(HOSTS)("$name: after a reject", (host) => {
    it("a source cited from before the pause is still a link and a chip", () => {
        mountOn([host]);
        firstLeg();
        // The model rejects gracefully and goes on to cite what it found before the pause;
        // the resumed leg's one new find is something else.
        act(() => latest.onReject());
        const resumed = decides().at(-1)!;
        act(() =>
            resumed.onSources([source("task", "task:70", { title: "Other", task_id: "70" })])
        );
        act(() =>
            resumed.onDelta("I did not make it. The cause was [the login redirect](task:9).")
        );
        act(() => resumed.onDone("sess-1", "run-p", 800));
        expect(screen.getByRole("button", { name: "the login redirect" })).toBeTruthy();
        expect(screen.getByRole("button", { name: /PRJ-9: Fix login/ })).toBeTruthy();
    });
});

describe("the same conversation in two hosts at once", () => {
    it("the overlay and the Genos page (one state) show the same chips and links", () => {
        mountOn([OVERLAY, PAGE]);
        firstLeg();
        resumedLeg("approve");
        for (const h of [OVERLAY, PAGE]) {
            const scope = within(screen.getByTestId(h.name));
            expect(scope.getByRole("button", { name: "the login redirect" })).toBeTruthy();
            expect(scope.getByRole("button", { name: /PRJ-9: Fix login/ })).toBeTruthy();
            expect(scope.getByRole("button", { name: /PRJ-55: Ship the fix/ })).toBeTruthy();
        }
    });

    it("two copies of the conversation: one stream, one chip list, no chip twice", () => {
        mountOn([CONVERSATION, PAGE]);
        firstLeg();
        resumedLeg("approve");
        for (const h of [CONVERSATION, PAGE]) {
            const scope = within(screen.getByTestId(h.name));
            expect(scope.getAllByRole("button", { name: /PRJ-9: Fix login/ })).toHaveLength(1);
            expect(scope.getAllByRole("button", { name: /PRJ-55: Ship the fix/ })).toHaveLength(1);
        }
        expect(asks()).toHaveLength(1);
        expect(decides()).toHaveLength(1);
    });
});

describe("two separate hook instances side by side", () => {
    // A thread Ask conversation and Spotlight, each with its own useAgentQA and its
    // own stream, decided in turn: neither leaks a chip into the other. (Not the modal
    // itself: it draws in a portal, outside the element the test scopes to.)
    const OTHER = source("task", "task:70", {
        title: "Unrelated",
        task_id: "70",
        task_display_id: "PRJ-70",
    });
    let second: UseAgentQAReturn;
    const Two = () => {
        const a = useAgentQA({ accessToken: "tok", teamId: "t1" });
        const b = useAgentQA({ accessToken: "tok", teamId: "t1" });
        latest = a;
        second = b;
        return (
            <>
                <div data-testid="a">{CONVERSATION.draw(a)}</div>
                <div data-testid="b">{PAGE.draw(b)}</div>
            </>
        );
    };

    it("each keeps its own chips through an interleaved pause and decision", () => {
        render(
            <CssVarsProvider>
                <Two />
            </CssVarsProvider>
        );
        act(() => {
            latest.onAsk("question a");
        });
        act(() => {
            second.onAsk("question b");
        });
        const [streamA, streamB] = asks();
        act(() => streamA.onSources([THREAD, FOUND]));
        act(() => streamB.onSources([OTHER]));
        act(() => streamA.onPendingApproval?.(PENDING));
        act(() =>
            streamB.onPendingApproval?.({ ...PENDING, approval_token: "tok-b", run_id: "run-b" })
        );

        act(() => latest.onApprove());
        act(() => second.onApprove());
        const [decideA, decideB] = decides();
        act(() =>
            decideB.onSources([source("task", "task:71", { task_id: "71", operated: true })])
        );
        act(() => decideA.onSources([CREATED]));
        act(() => decideA.onDelta(ANSWER));
        act(() => decideA.onDone("sess-a", "run-p", 10));
        act(() =>
            decideB.onDelta("Made it. Also see [the unrelated one](task:70) and [it](task:71).")
        );
        act(() => decideB.onDone("sess-b", "run-b", 10));

        const a = within(screen.getByTestId("a"));
        const b = within(screen.getByTestId("b"));
        expect(a.getByRole("button", { name: "the login redirect" })).toBeTruthy();
        expect(a.getByRole("button", { name: "the follow-up" })).toBeTruthy();
        expect(a.queryByRole("button", { name: /PRJ-70/ })).toBeNull();
        expect(b.getByRole("button", { name: "the unrelated one" })).toBeTruthy();
        expect(b.getByRole("button", { name: "it" })).toBeTruthy();
        expect(b.queryByRole("button", { name: /PRJ-9:/ })).toBeNull();
        expect(b.queryByRole("button", { name: /PRJ-55/ })).toBeNull();
        expect(latest.turns[0].answerSources.map((s) => s.entity_id)).toEqual([
            THREAD.entity_id,
            FOUND.entity_id,
            CREATED.entity_id,
        ]);
        expect(second.turns[0].answerSources.map((s) => s.entity_id)).toEqual([
            OTHER.entity_id,
            "task:71",
        ]);
    });
});

// Renders of ONE finished turn that one `sources` event adding a chip causes, MEASURED
// on origin/main at the base of this change (replace on every event) on all three
// kinds of host: 1. The new chip is a new list, and the conversation-wide lookup built
// from it is handed to every turn.
const RENDERS_PER_NEW_CHIP_ON_MAIN = 1;

describe("render budget (MIP-904)", () => {
    // Turn 1 is finished and carries a tagged tool step, so one render of it is one
    // `ToolProgressList` call tagged "turn-1". Turn 2 is live.
    const finishedTurn = () => {
        const stream = start("first question");
        act(() => stream.onToolStart?.({ step: 1, tool_name: "search_workspace", arguments: {} }));
        act(() =>
            stream.onToolResult?.({
                step: 1,
                tool_name: "search_workspace",
                summary: "turn-1",
            })
        );
        act(() => stream.onSources([FOUND]));
        act(() => stream.onDelta("It is [the login redirect](task:9)."));
        act(() => stream.onDone("sess-1", "run-1", 10));
        return start("second question");
    };
    const finishedRenders = () => counts.turns.filter((t) => t === "turn-1").length;

    it.each([
        ["thread / note Ask (AgentQAConversation)", CONVERSATION],
        ["Spotlight overlay", OVERLAY],
        ["Genos page", PAGE],
    ])("%s: an event that adds nothing renders no finished turn", (_name, host) => {
        mountOn([host]);
        const live = finishedTurn();
        act(() => live.onSources([THREAD, CREATED]));
        const before = finishedRenders();
        expect(before).toBeGreaterThan(0);

        // The same set again (as new objects), and re-ranked: nothing to show.
        act(() => live.onSources(JSON.parse(JSON.stringify([THREAD, CREATED]))));
        act(() => live.onSources([CREATED, THREAD]));
        act(() => live.onSources([]));
        expect(finishedRenders()).toBe(before);
    });

    it.each([
        ["thread / note Ask (AgentQAConversation)", CONVERSATION],
        ["Spotlight overlay", OVERLAY],
        ["Genos page", PAGE],
    ])(
        "%s: a new chip renders the finished turn no more often than it did on main",
        (_name, host) => {
            mountOn([host]);
            const live = finishedTurn();
            const before = finishedRenders();
            act(() => live.onSources([THREAD]));
            act(() => live.onSources([THREAD, CREATED]));
            expect(finishedRenders() - before).toBeLessThanOrEqual(
                2 * RENDERS_PER_NEW_CHIP_ON_MAIN
            );
        }
    );
});
