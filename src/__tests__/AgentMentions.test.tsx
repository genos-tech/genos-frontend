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
    matchMentionTokens,
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

    it("allows spaces in the query (multi-word titles) but stops at newlines", () => {
        expect(detectMentionTrigger("#How to get", 11)).toMatchObject({
            char: "#",
            query: "How to get",
        });
        expect(detectMentionTrigger("#Fix\nlogin", 10)).toBeNull();
    });

    it("caps the lookback so distant prose can't re-trigger", () => {
        const value = `#${"x".repeat(70)}`;
        expect(detectMentionTrigger(value, value.length)).toBeNull();
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

    it("shows nothing for a bare trigger (empty query)", () => {
        const { result } = renderHook(() => useHarness());
        act(() => {
            result.current.setValue("#");
        });
        act(() => {
            result.current.draft.setCaret(1);
        });
        expect(result.current.draft.pickerOpen).toBe(false);
        act(() => {
            result.current.setValue("@ ");
        });
        act(() => {
            result.current.draft.setCaret(2);
        });
        expect(result.current.draft.pickerOpen).toBe(false);
    });

    it("keeps narrowing across spaces and closes right after a pick", () => {
        const { result } = renderHook(() => useHarness());
        act(() => {
            result.current.setValue("#Fix login b");
        });
        act(() => {
            result.current.draft.setCaret(12);
        });
        // Multi-word query narrows to the one matching title.
        expect(result.current.draft.suggestions.map((s) => s.key)).toEqual(["task:2"]);
        act(() => {
            result.current.draft.selectSuggestion(ENTITIES[1]); // "#Fix login bug "
        });
        // The inserted token's trailing space matches no title → closed.
        expect(result.current.value).toBe("#Fix login bug ");
        expect(result.current.draft.pickerOpen).toBe(false);
        // Continuing the sentence keeps it closed.
        act(() => {
            result.current.setValue("#Fix login bug status?");
        });
        act(() => {
            result.current.draft.setCaret(22);
        });
        expect(result.current.draft.pickerOpen).toBe(false);
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
        // User edits Alice's token away before sending — a bare name
        // without the trigger char is prose, not a mention.
        expect(result.current.draft.consumeMentions("ask Bob instead")).toEqual([]);
        // Consuming clears picks, but "@Alice" is an exact candidate
        // token, so it AUTO-resolves — picked or not, the same text
        // sends the same mention.
        expect(result.current.draft.consumeMentions("@Alice")).toEqual([MEMBERS[0].ref]);
    });

    it("typed-exact tokens auto-attach without a pick; partials never do", () => {
        const { result } = renderHook(() => useHarness());
        // Whole label after the trigger → highlight + wire ref, no pick.
        act(() => {
            result.current.setValue("status of #Write docs please");
        });
        expect(result.current.draft.highlightRanges).toEqual([
            { ref: ENTITIES[2].ref, start: 10, end: 21 },
        ]);
        expect(result.current.draft.consumeMentions("status of #Write docs please")).toEqual([
            ENTITIES[2].ref,
        ]);
        // A partial title is still just typing.
        act(() => {
            result.current.setValue("status of #Write doc please");
        });
        expect(result.current.draft.highlightRanges).toEqual([]);
        // Wrong trigger for the kind doesn't resolve either.
        act(() => {
            result.current.setValue("status of @Write docs please");
        });
        expect(result.current.draft.highlightRanges).toEqual([]);
    });

    it("a ref picked AND typed twice highlights both tokens but sends one wire ref", () => {
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
        act(() => {
            result.current.setValue("@Alice ping @Alice again");
        });
        expect(result.current.draft.highlightRanges.map((r) => [r.start, r.end])).toEqual([
            [0, 6],
            [12, 18],
        ]);
        expect(result.current.draft.consumeMentions("@Alice ping @Alice again")).toEqual([
            MEMBERS[0].ref,
        ]);
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

    it("a picked @group highlights and reaches consumeMentions", () => {
        // Regression: the token matcher inferred the trigger as
        // `kind === "user" ? "@" : "#"`, so a picked group was searched
        // as "#test-group" while the text held "@test-group" — no
        // highlight, and the ref was silently dropped from the payload.
        const group: AgentMentionCandidate = {
            ref: { kind: "group", groupId: 3, label: "test-group" },
            trigger: "@",
            key: "group:3",
        };
        const { result } = renderHook(() => {
            const [value, setValue] = useState("");
            const draft = useAgentMentionDraft({
                value,
                onChange: setValue,
                members: [group],
                entities: [],
            });
            return { value, setValue, draft };
        });
        act(() => {
            result.current.setValue("who is in @test");
        });
        act(() => {
            result.current.draft.setCaret(15);
        });
        expect(result.current.draft.suggestions).toEqual([group]);
        act(() => {
            result.current.draft.selectSuggestion(group);
        });
        expect(result.current.value).toBe("who is in @test-group ");
        expect(result.current.draft.highlightRanges).toEqual([
            { ref: group.ref, start: 10, end: 21 },
        ]);
        expect(result.current.draft.consumeMentions("who is in @test-group ?")).toEqual([
            { kind: "group", groupId: 3, label: "test-group" },
        ]);
    });

    it("highlightRanges tracks live tokens and follows edits", () => {
        const { result } = renderHook(() => useHarness());
        act(() => {
            result.current.setValue("ask @Al");
        });
        act(() => {
            result.current.draft.setCaret(7);
        });
        expect(result.current.draft.highlightRanges).toEqual([]);
        act(() => {
            result.current.draft.selectSuggestion(MEMBERS[0]); // "ask @Alice "
        });
        expect(result.current.draft.highlightRanges).toEqual([
            { ref: MEMBERS[0].ref, start: 4, end: 10 },
        ]);
        // Editing the token away drops the highlight (WYSIWYG with what
        // consumeMentions would send).
        act(() => {
            result.current.setValue("ask Bob instead");
        });
        expect(result.current.draft.highlightRanges).toEqual([]);
        // ...and restoring the exact token text brings it back.
        act(() => {
            result.current.setValue("hey @Alice");
        });
        expect(result.current.draft.highlightRanges).toEqual([
            { ref: MEMBERS[0].ref, start: 4, end: 10 },
        ]);
        // Consuming clears the pick, but the token text still reads as
        // a mention via auto-resolve — the highlight (and a re-send)
        // survive, keeping WYSIWYG with what the next ask would send.
        act(() => {
            result.current.draft.consumeMentions(result.current.value);
        });
        expect(result.current.draft.highlightRanges).toEqual([
            { ref: MEMBERS[0].ref, start: 4, end: 10 },
        ]);
    });
});

// ---- matchMentionTokens ------------------------------------------------

describe("matchMentionTokens", () => {
    const alice = { kind: "user", userId: "u-alice", label: "Alice" } as const;
    const fixLogin = { kind: "task", taskId: 1, label: "Fix login" } as const;
    const fixLoginBug = { kind: "task", taskId: 2, label: "Fix login bug" } as const;

    it("returns sorted ranges with word-boundary rules", () => {
        const matches = matchMentionTokens("ping @Alice re #Fix login bug now", [
            fixLoginBug,
            alice,
        ]);
        expect(matches).toEqual([
            { ref: alice, start: 5, end: 11 },
            { ref: fixLoginBug, start: 15, end: 29 },
        ]);
    });

    it("assigns overlapping tokens to the longest label", () => {
        const matches = matchMentionTokens("see #Fix login bug", [fixLogin, fixLoginBug]);
        expect(matches).toEqual([{ ref: fixLoginBug, start: 4, end: 18 }]);
    });

    it("rejects mid-word occurrences", () => {
        expect(matchMentionTokens("mail@Alice", [alice])).toEqual([]);
        expect(matchMentionTokens("@Aliceland", [alice])).toEqual([]);
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
// Absolute URL so `buildAvatarSrc` passes it through unchanged (the test
// env has no VITE_MEDIA_ROOT_DJANGO, under which a relative path would
// resolve to undefined and fall back to the initial).
const ALICE_AVATAR = "https://cdn.example.com/avatars/alice.png";

vi.mock("../features/agentQA/mentions/useAgentMentionSources", () => ({
    useAgentMentionSources: () => ({
        members: [
            {
                ref: { kind: "user", userId: "u-alice", label: "Alice" },
                trigger: "@",
                key: "user:u-alice",
                avatarImgPath: ALICE_AVATAR,
            },
        ],
        entities: [
            {
                ref: { kind: "task", taskId: 7, label: "Ship v2" },
                trigger: "#",
                key: "task:7",
                subtitle: "APL-7",
            },
            {
                // A milestone-flagged task — resolves as a task, but the
                // row must read "Milestone".
                ref: { kind: "task", taskId: 8, label: "v1 launch", isMilestone: true },
                trigger: "#",
                key: "task:8",
                subtitle: "APL-8",
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

    it("labels a milestone-flagged task row 'Milestone', a plain task 'Task'", async () => {
        const onAsk = vi.fn();
        render(<Harness onAsk={onAsk} />);
        const textarea = screen.getByPlaceholderText("Ask…");

        // The two-line row shows the title as `#<title>` over a muted
        // "<kind> · <id>" subtitle. The milestone-flagged task's subtitle
        // reads "Milestone · …", not "Task · …".
        fireEvent.change(textarea, { target: { value: "#v1" } });
        expect(await screen.findByTestId("agent-mention-dropdown")).toBeInTheDocument();
        const milestoneRow = screen.getByTestId("agent-mention-option-task:8");
        expect(milestoneRow).toHaveTextContent("#v1 launch");
        expect(milestoneRow).toHaveTextContent("Milestone · APL-8");

        // A plain task's subtitle reads "Task · …".
        fireEvent.change(textarea, { target: { value: "#Ship" } });
        await waitFor(() => {
            const taskRow = screen.getByTestId("agent-mention-option-task:7");
            expect(taskRow).toHaveTextContent("#Ship v2");
            expect(taskRow).toHaveTextContent("Task · APL-7");
        });
    });

    it("renders the user's profile photo in the @ row, not a generic icon", async () => {
        const onAsk = vi.fn();
        render(<Harness onAsk={onAsk} />);
        const textarea = screen.getByPlaceholderText("Ask…");

        fireEvent.change(textarea, { target: { value: "@Al" } });
        expect(await screen.findByTestId("agent-mention-dropdown")).toBeInTheDocument();

        const userRow = screen.getByTestId("agent-mention-option-user:u-alice");
        // The row shows an <img> whose src is the user's avatar, so the
        // dropdown displays the real face instead of a placeholder icon.
        const img = userRow.querySelector("img");
        expect(img).not.toBeNull();
        expect(img).toHaveAttribute("src", ALICE_AVATAR);
    });

    it("submits a milestone-flagged mention as a plain task ref", async () => {
        const onAsk = vi.fn();
        render(<Harness onAsk={onAsk} />);
        const textarea = screen.getByPlaceholderText("Ask…");

        fireEvent.change(textarea, { target: { value: "#v1" } });
        expect(await screen.findByTestId("agent-mention-dropdown")).toBeInTheDocument();
        fireEvent.keyDown(textarea, { key: "Enter" });
        await waitFor(() => {
            expect((textarea as HTMLTextAreaElement).value).toBe("#v1 launch ");
        });
        fireEvent.keyDown(textarea, { key: "Enter" });
        // The ref keeps kind:"task" (+ display-only isMilestone) so the
        // wire conversion downstream sends a task, not a new milestone kind.
        expect(onAsk).toHaveBeenCalledWith(undefined, [
            { kind: "task", taskId: 8, label: "v1 launch", isMilestone: true },
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
        fireEvent.change(textarea, { target: { value: "@Al" } });
        expect(screen.getByTestId("agent-mention-dropdown")).toBeInTheDocument();
        fireEvent.keyDown(textarea, { key: "ArrowDown" });
        fireEvent.keyDown(textarea, { key: "ArrowUp" });
        expect(onAsk).not.toHaveBeenCalled();
    });

    it("a bare trigger shows no dropdown", () => {
        const onAsk = vi.fn();
        render(<Harness onAsk={onAsk} />);
        const textarea = screen.getByPlaceholderText("Ask…");
        fireEvent.change(textarea, { target: { value: "@" } });
        expect(screen.queryByTestId("agent-mention-dropdown")).toBeNull();
    });

    it("does not submit on the Enter that CONFIRMS an IME composition", () => {
        // Japanese/Chinese/Korean input: the user types phonetics into a
        // composition buffer and presses Enter to CONFIRM the conversion.
        // That Enter must not fire the ask (which would send early AND
        // leave the just-committed text stranded in the box). Both the
        // modern `isComposing` flag and the legacy keyCode 229 sentinel
        // must be honored.
        const onAsk = vi.fn();
        render(<Harness onAsk={onAsk} />);
        const textarea = screen.getByPlaceholderText("Ask…") as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: "日本語の質問" } });

        fireEvent.keyDown(textarea, { key: "Enter", isComposing: true });
        expect(onAsk).not.toHaveBeenCalled();
        fireEvent.keyDown(textarea, { key: "Enter", keyCode: 229 });
        expect(onAsk).not.toHaveBeenCalled();

        // Once the composition ends, a real Enter submits normally.
        fireEvent.keyDown(textarea, { key: "Enter" });
        expect(onAsk).toHaveBeenCalledTimes(1);
    });

    it("highlights the picked token in the input and unhighlights when edited away", async () => {
        const onAsk = vi.fn();
        render(<Harness onAsk={onAsk} />);
        const textarea = screen.getByPlaceholderText("Ask…");

        // Bare prose — an entity name without its trigger char — never
        // highlights.
        fireEvent.change(textarea, { target: { value: "ping Alice" } });
        expect(screen.queryByTestId("mention-highlight-overlay")).toBeNull();

        // Typing the exact token auto-resolves without a pick.
        fireEvent.change(textarea, { target: { value: "status of #Ship v2" } });
        expect(screen.getByTestId("mention-highlight-overlay")).toBeInTheDocument();

        // Pick from the menu → the token gets the marker highlight.
        fireEvent.change(textarea, { target: { value: "ping @Al" } });
        fireEvent.keyDown(textarea, { key: "Enter" });
        await waitFor(() => {
            expect(screen.getByTestId("mention-highlight-overlay")).toBeInTheDocument();
        });
        expect(screen.getByTestId("mention-highlight-token")).toHaveTextContent("@Alice");

        // Editing the token away removes the highlight.
        fireEvent.change(textarea, { target: { value: "ping Bob" } });
        expect(screen.queryByTestId("mention-highlight-overlay")).toBeNull();
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

    it("retry (overrideQuery) without refs sends no mentions key", async () => {
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

    it("completed turns carry their mentions; retrying with them re-sends the wire refs", async () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDelta("Bob is on the redesign.");
            args.onDone("sess-1", "run-1");
        });
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        const refs = [{ kind: "user", userId: "u-bob", label: "Bob" } as const];
        act(() => {
            result.current.onAsk("what is @Bob working on?", [...refs]);
        });
        await waitFor(() => {
            expect(result.current.turns).toHaveLength(1);
        });
        // The snapshot keeps the refs the ask was sent with…
        expect(result.current.turns[0].mentions).toEqual(refs);
        // …and the retry path (TurnView passes turn.mentions back into
        // onAsk) re-sends the same wire shape.
        act(() => {
            result.current.onAsk(
                result.current.turns[0].askedQuery,
                result.current.turns[0].mentions
            );
        });
        await waitFor(() => {
            expect(askAgentStream).toHaveBeenCalledTimes(2);
        });
        expect(vi.mocked(askAgentStream).mock.calls[1][0].mentions).toEqual([
            { type: "user", user_id: "u-bob", label: "Bob" },
        ]);
    });
});

// ---- useSpotlight background stream on close --------------------------

describe("useSpotlight keeps the agent stream running after close", () => {
    beforeEach(() => {
        vi.mocked(askAgentStream).mockClear();
        localStorage.clear();
    });

    it("does not abort the in-flight ask on close and still promotes on done", async () => {
        // Hold the stream open (don't call onDone yet) and capture the args
        // so we can inspect the AbortSignal and drive completion later.
        let captured: Parameters<typeof askAgentStream>[0] | null = null;
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            captured = args;
        });
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.open();
        });
        act(() => {
            result.current.onAsk("why is the sky blue?");
        });
        await waitFor(() => expect(askAgentStream).toHaveBeenCalledTimes(1));
        expect(result.current.ask.isStreaming).toBe(true);

        // Close the overlay while the answer is still streaming.
        act(() => {
            result.current.close();
        });
        // The stream must NOT be aborted, and the streaming flag is kept so
        // re-opening shows the spinner rather than a dead partial turn.
        expect(captured?.signal?.aborted).toBe(false);
        expect(result.current.ask.isStreaming).toBe(true);

        // The background stream finishes while the overlay is closed → the
        // turn is promoted into history and streaming clears, so re-opening
        // shows the completed answer.
        act(() => {
            captured?.onDelta("Because of Rayleigh scattering.");
            captured?.onDone("sess-1", "run-1");
        });
        await waitFor(() => expect(result.current.turns).toHaveLength(1));
        expect(result.current.turns[0].answer).toBe("Because of Rayleigh scattering.");
        expect(result.current.ask.isStreaming).toBe(false);
    });
});
