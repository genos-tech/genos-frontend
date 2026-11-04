/**
 * The source chips of ONE turn across an approval pause (MIP-997).
 *
 * An agent run that pauses on a write is two streams of the same turn: the
 * `/ask/` leg and the `/decide/` leg that resumes it. The server keeps its list
 * of sources per leg (`resume_agent` seeds the resumed loop with only what the
 * approved write created), so a `sources` event of the resumed leg does not
 * contain what the first leg found, the thread / note the ask was opened from
 * included. The client used to REPLACE its chip list on every event, so after a
 * decision everything from before the pause was gone.
 *
 * The events below are shaped like the server's (every field present, nulls
 * for what a source does not have; see `_blank_source` in the agent
 * controller), and arrive the way the stream delivers them: through the
 * handlers `useAgentQA` hands to `askAgentStream` and `decideAgent`.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentQA } from "../features/agentQA";
import type { SpotlightResult } from "../features/spotlight/types";
import { askAgentStream, decideAgent, type PendingApprovalPayload } from "../services/agentApi";

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(async () => {}),
    decideAgent: vi.fn(async () => {}),
    submitAgentFeedback: vi.fn(async () => true),
}));

type AskArgs = Parameters<typeof askAgentStream>[0];
type DecideArgs = Parameters<typeof decideAgent>[0];
const lastAsk = (): AskArgs => vi.mocked(askAgentStream).mock.calls.at(-1)![0];
const lastDecide = (): DecideArgs => vi.mocked(decideAgent).mock.calls.at(-1)![0];

// A source as the server ships it.
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
const NOTE = source("note", "note:personal:12", {
    title: "Q3 plan",
    note_id: "12",
    note_type: "personal",
});
const FOUND = source("task", "task:9", { title: "Fix login", task_id: "9" });
const CREATED = source("task", "task:55", {
    title: "Ship the fix",
    task_id: "55",
    operated: true,
});
const LATER = source("task", "task:60", { title: "Follow-up", task_id: "60" });

const PENDING: PendingApprovalPayload = {
    step: 2,
    tool_name: "create_task",
    arguments: {},
    approval_token: "tok-1",
    run_id: "run-p",
};

const ids = (list: readonly SpotlightResult[]) => list.map((s) => s.entity_id);

const mount = () => renderHook(() => useAgentQA({ accessToken: "tok", teamId: "t1" }));

// Ask, let the first leg send `legOne` (one event each), pause on a write.
const pausedAfter = (legOne: SpotlightResult[][]) => {
    const hook = mount();
    act(() => {
        hook.result.current.onAsk("what is blocked?");
    });
    for (const event of legOne) act(() => lastAsk().onSources(event));
    act(() => lastAsk().onPendingApproval?.(PENDING));
    return hook;
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(askAgentStream).mockImplementation(async () => {});
    vi.mocked(decideAgent).mockImplementation(async () => {});
});

describe("the chips of a turn after an approve", () => {
    it("are the union of both legs: what the first leg found, then what the resumed leg adds", () => {
        const { result } = pausedAfter([[THREAD], [THREAD, FOUND]]);
        expect(ids(result.current.ask.answerSources)).toEqual([THREAD.entity_id, FOUND.entity_id]);

        act(() => result.current.onApprove());
        // The resumed leg knows only what the approved write created, and ships
        // it twice (once when the write ran, once re-ranked before `done`).
        act(() => lastDecide().onSources([CREATED]));
        act(() => lastDecide().onSources([CREATED]));

        expect(ids(result.current.ask.answerSources)).toEqual([
            THREAD.entity_id,
            FOUND.entity_id,
            CREATED.entity_id,
        ]);
    });

    it("keep the first leg's chips when the resumed leg finds more after the write", () => {
        const { result } = pausedAfter([[THREAD, FOUND]]);
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([CREATED]));
        act(() => lastDecide().onSources([CREATED, LATER]));
        expect(ids(result.current.ask.answerSources)).toEqual([
            THREAD.entity_id,
            FOUND.entity_id,
            CREATED.entity_id,
            LATER.entity_id,
        ]);
    });

    it("go into the promoted turn as that union", () => {
        const { result } = pausedAfter([[THREAD, FOUND]]);
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([CREATED]));
        act(() => lastDecide().onDelta("Done."));
        act(() => lastDecide().onDone("sess-1", "run-p", 900));
        expect(result.current.turns).toHaveLength(1);
        expect(ids(result.current.turns[0].answerSources)).toEqual([
            THREAD.entity_id,
            FOUND.entity_id,
            CREATED.entity_id,
        ]);
    });
});

describe("the chips of a turn after a reject", () => {
    it("are the union of both legs when the resumed leg finds something new", () => {
        const { result } = pausedAfter([[THREAD, FOUND]]);
        act(() => result.current.onReject());
        act(() => lastDecide().onSources([LATER]));
        expect(ids(result.current.ask.answerSources)).toEqual([
            THREAD.entity_id,
            FOUND.entity_id,
            LATER.entity_id,
        ]);
    });
});

describe("a thread or note ask", () => {
    it("keeps the thread chip after a decision", () => {
        const { result } = pausedAfter([[THREAD]]);
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([CREATED]));
        expect(ids(result.current.ask.answerSources)).toEqual([
            THREAD.entity_id,
            CREATED.entity_id,
        ]);
    });

    it("keeps the note chip after a decision", () => {
        const { result } = pausedAfter([[NOTE]]);
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([CREATED]));
        expect(ids(result.current.ask.answerSources)).toEqual([NOTE.entity_id, CREATED.entity_id]);
    });
});
