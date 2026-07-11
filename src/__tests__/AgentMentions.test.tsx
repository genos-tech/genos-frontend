/**
 * Agent-input @/# mention tests (features/agentQA/mentions).
 *
 * Covers:
 *   - `detectMentionTrigger` — whitespace-preceded @/# rule (emails and
 *     mid-word hashes don't trigger).
 *   - `useAgentMentionDraft` — suggestion filtering/ranking, token
 *     splice + caret, Escape dismissal, and `consumeMentions` pruning
 *     (edited-away tokens dropped, longest-label overlap wins).
 *   - `AgentQAInput` integration — picker opens on `@`, Enter selects
 *     (does NOT submit), Escape closes without bubbling to the host
 *     modal, and submit hands the surviving refs to `state.onAsk`.
 *   - `useSpotlight.onAsk` — refs are converted to the snake_case wire
 *     shape on askAgentStream; retry sends none.
 */

import { useState } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentQAInput } from "../features/agentQA/AgentQAInput";
import type { AgentMentionCandidate } from "../features/agentQA/mentions/types";
import {
    detectMentionTrigger,
    useAgentMentionDraft,
} from "../features/agentQA/mentions/useAgentMentionDraft";
import {
    EMPTY_ASK_STATE,
    type AgentQALabels,
    type UseAgentQAReturn,
} from "../features/agentQA/types";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { askAgentStream } from "../services/agentApi";

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        askAgentStream: vi.fn(),
        decideAgent: vi.fn(),
        fetchAgentSessionDetail: vi.fn(async () => null),
        fetchAgentSessions: vi.fn(async () => []),
        fetchAgentUsage: vi.fn(async () => null),
        submitAgentFeedback: vi.fn(async () => true),
    };
});

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const member = (userId: string, userName: string): AgentMentionCandidate => ({
    ref: { kind: "user", userId, label: userName },
    trigger: "@",
    key: `user:${userId}`,
});

const taskCandidate = (taskId: number, title: string): AgentMentionCandidate => ({
    ref: { kind: "task", taskId, label: title },
    trigger: "#",
    key: `task:${taskId}`,
});

const MEMBERS = [member("u-alice", "Alice"), member("u-bob", "Bob"), member("u-aliceb", "AliceB")];
const ENTITIES = [
    taskCandidate(1, "Fix login"),
    taskCandidate(2, "Fix login bug"),
    taskCandidate(3, "Write docs"),
];

describe("detectMentionTrigger", () => {
    it("activates on a bare @ and a bare #", () => {
        expect(detectMentionTrigger("hello @A", 8)).toMatchObject({ char: "@", query: "A" });
        expect(detectMentionTrigger("#Fix", 4)).toMatchObject({ char: "#", query: "Fix" });
    });

    it("does not activate mid-word (emails, URL fragments)", () => {
        expect(detectMentionTrigger("me@host", 7)).toBeNull();
        expect(detectMentionTrigger("a#1", 3)).toBeNull();
    });

    it("deactivates once the query crosses whitespace", () => {
        expect(detectMentionTrigger("@Alice hey", 10)).toBeNull();
    });
});

// Controlled-hook harness: the hook takes value/onChange, so give it a
// real useState to write through — mirroring how the surfaces use it.
function useHarness() {
    const [value, setValue] = useState("");
    const draft = useAgentMentionDraft({
        value,
        onChange: setValue,
        members: MEMBERS,
        entities: ENTITIES,
    });
    return { value, setValue, draft };
}

describe("useAgentMentionDraft", () => {
    it("filters @ suggestions by substring and ranks prefix matches first", () => {
        const { result } = renderHook(() => useHarness());
        act(() => {
            result.current.setValue("hi @li");
        });
        act(() => {
            result.current.draft.setCaret(6);
        });
        // Substring matches: Alice + AliceB (both contain "li").
        expect(result.current.draft.pickerOpen).toBe(true);
        expect(result.current.draft.suggestions.map((s) => s.key)).toEqual([
            "user:u-alice",
            "user:u-aliceb",
        ]);
    });

    it("serves # suggestions from the entity pool", () => {
        const { result } = renderHook(() => useHarness());
        act(() => {
            result.current.setValue("#docs");
        });
        act(() => {
            result.current.draft.setCaret(5);
        });
        expect(result.current.draft.suggestions.map((s) => s.key)).toEqual(["task:3"]);
    });

    it("selectSuggestion splices the token and reports the new caret", () => {
        const { result } = renderHook(() => useHarness());
        act(() => {
            result.current.setValue("ask @Al about it");
        });
        act(() => {
            result.current.draft.setCaret(7); // caret after "@Al"
        });
        let caret = 0;
        act(() => {
            caret = result.current.draft.selectSuggestion(MEMBERS[0]);
        });
        expect(result.current.value).toBe("ask @Alice  about it");
        expect(caret).toBe("ask @Alice ".length);
    });

    it("Escape dismisses the current trigger only; a fresh trigger re-arms", () => {
        const { result } = renderHook(() => useHarness());
        act(() => {
            result.current.setValue("@Al");
        });
        act(() => {
            result.current.draft.setCaret(3);
        });
        expect(result.current.draft.pickerOpen).toBe(true);
        act(() => {
            result.current.draft.closePicker();
        });
        expect(result.current.draft.pickerOpen).toBe(false);
        // New trigger later in the text re-opens the picker.
        act(() => {
            result.current.setValue("@Alice @B");
        });
        act(() => {
            result.current.draft.setCaret(9);
        });
        expect(result.current.draft.pickerOpen).toBe(true);
    });

    it("consumeMentions keeps only refs whose token survived editing", () => {
        const { result } = renderHook(() => useHarness());
        act(() => {
            result.current.setValue("@Al");
        });
        act(() => {
            result.current.draft.setCaret(3);
        });
        act(() => {
            result.current.draft.selectSuggestion(MEMBERS[0]); // "@Alice "
        });
        // User edits Alice's token away before sending.
        expect(result.current.draft.consumeMentions("ask Bob instead")).toEqual([]);
        // ...and consuming clears picks: a stale pick can't resurface.
        expect(result.current.draft.consumeMentions("@Alice")).toEqual([]);
    });

    it("consumeMentions assigns overlapping tokens to the longest label", () => {
        const { result } = renderHook(() => useHarness());
        // Pick both "Fix login" and "Fix login bug".
        act(() => {
            result.current.setValue("#Fix");
        });
        act(() => {
            result.current.draft.setCaret(4);
        });
        act(() => {
            result.current.draft.selectSuggestion(ENTITIES[0]);
        });
        act(() => {
            result.current.setValue("#Fix login #x");
        });
        act(() => {
            result.current.draft.setCaret(13);
        });
        act(() => {
            result.current.draft.selectSuggestion(ENTITIES[1]);
        });
        // Final text mentions ONLY the longer task title.
        const refs = result.current.draft.consumeMentions("status of #Fix login bug please");
        expect(refs).toEqual([{ kind: "task", taskId: 2, label: "Fix login bug" }]);
    });

    it("consumeMentions requires a word boundary after the token", () => {
        const { result } = renderHook(() => useHarness());
        act(() => {
            result.current.setValue("@Al");
        });
        act(() => {
            result.current.draft.setCaret(3);
        });
        act(() => {
            result.current.draft.selectSuggestion(MEMBERS[0]); // picks Alice
        });
        // "@Aliceland" must not count as a mention of Alice.
        expect(result.current.draft.consumeMentions("visit @Aliceland")).toEqual([]);
    });
});

// ---- AgentQAInput integration ----------------------------------------

const LABELS: AgentQALabels = {
    conversation: {
        empty: "",
        turnLabelQ: "Q",
        turnLabelA: "A",
        placeholder: "Ask…",
        send: "Send",
        cancel: "Cancel",
    },
    actions: { approve: "", reject: "", copyAnswer: "", copied: "", retry: "" },
    states: { streaming: "", thinking: "" },
    approval: { titleWithTool: "{toolName}" },
    mentions: { ariaLabel: "Mention suggestions" },
};

// AgentQAInput reads members via AvatarContext / entities via
// HashMentionData. Mock the sources hook instead of standing up the
// full provider tree — the sources hook has its own thin adapter logic
// and the providers are exercised in the real app.
vi.mock("../features/agentQA/mentions/useAgentMentionSources", () => ({
    useAgentMentionSources: () => ({
        members: [
            {
                ref: { kind: "user", userId: "u-alice", label: "Alice" },
                trigger: "@",
                key: "user:u-alice",
            },
        ],
        entities: [
            {
                ref: { kind: "task", taskId: 7, label: "Ship v2" },
                trigger: "#",
                key: "task:7",
            },
        ],
    }),
}));

function Harness({ onAsk }: { onAsk: UseAgentQAReturn["onAsk"] }) {
    const [query, setQuery] = useState("");
    const state = {
        query,
        setQuery,
        ask: EMPTY_ASK_STATE,
        turns: [],
        sessionId: null,
        onAsk,
        onCancel: vi.fn(),
        onApprove: vi.fn(),
        onReject: vi.fn(),
        clearConversation: vi.fn(),
        reset: vi.fn(),
        submitFeedback: vi.fn(),
    } as UseAgentQAReturn;
    return <AgentQAInput labels={LABELS} state={state} />;
}

describe("AgentQAInput mention integration", () => {
    it("opens the picker on @, Enter selects without submitting, next Enter submits with refs", async () => {
        const onAsk = vi.fn();
        render(<Harness onAsk={onAsk} />);
        const textarea = screen.getByPlaceholderText("Ask…");

        fireEvent.change(textarea, { target: { value: "@Al" } });
        expect(await screen.findByTestId("agent-mention-dropdown")).toBeInTheDocument();

        // Enter while the picker is open picks the highlighted row —
        // no submit.
        fireEvent.keyDown(textarea, { key: "Enter" });
        expect(onAsk).not.toHaveBeenCalled();
        await waitFor(() => {
            expect((textarea as HTMLTextAreaElement).value).toBe("@Alice ");
        });

        fireEvent.change(textarea, { target: { value: "@Alice what is she doing?" } });
        fireEvent.keyDown(textarea, { key: "Enter" });
        expect(onAsk).toHaveBeenCalledWith(undefined, [
            { kind: "user", userId: "u-alice", label: "Alice" },
        ]);
    });

    it("Escape closes the picker and does not bubble to the host modal", () => {
        const onAsk = vi.fn();
        const hostEscape = vi.fn();
        render(
            <div onKeyDown={(e) => e.key === "Escape" && hostEscape()}>
                <Harness onAsk={onAsk} />
            </div>
        );
        const textarea = screen.getByPlaceholderText("Ask…");
        fireEvent.change(textarea, { target: { value: "#Ship" } });
        expect(screen.getByTestId("agent-mention-dropdown")).toBeInTheDocument();

        fireEvent.keyDown(textarea, { key: "Escape" });
        expect(screen.queryByTestId("agent-mention-dropdown")).toBeNull();
        expect(hostEscape).not.toHaveBeenCalled();

        // A second Escape (picker closed) reaches the host as usual.
        fireEvent.keyDown(textarea, { key: "Escape" });
        expect(hostEscape).toHaveBeenCalledTimes(1);
    });

    it("ArrowDown moves the picker highlight without submitting", () => {
        const onAsk = vi.fn();
        render(<Harness onAsk={onAsk} />);
        const textarea = screen.getByPlaceholderText("Ask…");
        fireEvent.change(textarea, { target: { value: "@" } });
        expect(screen.getByTestId("agent-mention-dropdown")).toBeInTheDocument();
        fireEvent.keyDown(textarea, { key: "ArrowDown" });
        fireEvent.keyDown(textarea, { key: "ArrowUp" });
        expect(onAsk).not.toHaveBeenCalled();
    });
});

// ---- useSpotlight wire conversion -------------------------------------

describe("useSpotlight mention forwarding", () => {
    beforeEach(() => {
        vi.mocked(askAgentStream).mockClear();
        localStorage.clear();
    });

    it("converts refs to the snake_case wire shape on ask", async () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDone("sess-1", "run-1");
        });
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.setQuery("status of #Fix login bug?");
        });
        act(() => {
            result.current.onAsk(undefined, [
                { kind: "task", taskId: 2, label: "Fix login bug" },
                { kind: "user", userId: "u-alice", label: "Alice" },
            ]);
        });
        await waitFor(() => {
            expect(askAgentStream).toHaveBeenCalledTimes(1);
        });
        expect(vi.mocked(askAgentStream).mock.calls[0][0].mentions).toEqual([
            { type: "task", task_id: 2, label: "Fix login bug" },
            { type: "user", user_id: "u-alice", label: "Alice" },
        ]);
    });

    it("retry (overrideQuery) sends no mentions key", async () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDone("sess-1", "run-1");
        });
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.onAsk("re-run this question");
        });
        await waitFor(() => {
            expect(askAgentStream).toHaveBeenCalledTimes(1);
        });
        expect(vi.mocked(askAgentStream).mock.calls[0][0].mentions).toBeUndefined();
    });
});
