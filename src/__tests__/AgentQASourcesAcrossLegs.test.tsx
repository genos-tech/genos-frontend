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

import { citedChipSources, useAgentQA, type UseAgentQAArgs } from "../features/agentQA";
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

// `renders` counts the renders of the host of the hook: a state write the hook
// did not make is a render the host did not get.
const mount = (args: Partial<UseAgentQAArgs> = {}) => {
    const probe = { renders: 0 };
    const hook = renderHook(() => {
        probe.renders += 1;
        return useAgentQA({ accessToken: "tok", teamId: "t1", ...args });
    });
    return Object.assign(hook, { probe });
};

// Ask, let the first leg send `legOne` (one event each), pause on a write.
const pausedAfter = (legOne: SpotlightResult[][], args: Partial<UseAgentQAArgs> = {}) => {
    const hook = mount(args);
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

describe("a turn that pauses twice", () => {
    // The case the server's per-leg list hurts most, because it needs no model to
    // forget a citation: the chip of an approved write is `operated`, so the chip
    // row always shows it, and the third leg starts from only ITS write.
    const SECOND: SpotlightResult = { ...source("task", "task:61"), operated: true };
    const PENDING_2: PendingApprovalPayload = { ...PENDING, step: 4, approval_token: "tok-2" };

    it("keeps the operated chip of the first approved write after the second", () => {
        const { result } = pausedAfter([[THREAD, FOUND]]);
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([CREATED]));
        act(() => lastDecide().onPendingApproval?.(PENDING_2));
        expect(ids(result.current.ask.answerSources)).toEqual([
            THREAD.entity_id,
            FOUND.entity_id,
            CREATED.entity_id,
        ]);

        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([SECOND]));
        act(() => lastDecide().onSources([SECOND]));

        const all = result.current.ask.answerSources;
        expect(ids(all)).toEqual([
            THREAD.entity_id,
            FOUND.entity_id,
            CREATED.entity_id,
            SECOND.entity_id,
        ]);
        // What the chip row would show of it: both writes, though the answer cites neither.
        expect(ids(citedChipSources("Both are done.", all))).toEqual([
            CREATED.entity_id,
            SECOND.entity_id,
        ]);
    });

    it("keeps `operated` when a later leg meets the same source without the flag", () => {
        const { result } = pausedAfter([[THREAD]]);
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([CREATED]));
        act(() => lastDecide().onPendingApproval?.(PENDING_2));
        act(() => result.current.onApprove());
        // The third leg READS task 55 (a plain source, no flag, a different title).
        act(() =>
            lastDecide().onSources([source("task", "task:55", { title: "Ship the fix v2" })])
        );
        const chip = result.current.ask.answerSources.find((s) => s.entity_id === "task:55");
        expect(chip).toMatchObject({ operated: true, title: "Ship the fix v2" });

        // ...and not even an explicit false takes it back.
        act(() => lastDecide().onSources([{ ...source("task", "task:55"), operated: false }]));
        expect(
            result.current.ask.answerSources.find((s) => s.entity_id === "task:55")?.operated
        ).toBe(true);
    });
});

describe("what counts as the same source", () => {
    it("a source sent twice, in one event or in two, is one chip", () => {
        const { result } = pausedAfter([
            [FOUND, FOUND],
            [FOUND, THREAD],
        ]);
        expect(ids(result.current.ask.answerSources)).toEqual([FOUND.entity_id, THREAD.entity_id]);
    });

    it("a chat thread with and without the chat: prefix is one chip, at its first place", () => {
        const prefixed = { ...THREAD, entity_id: `chat:${THREAD.entity_id}`, title: "Renamed" };
        const { result } = pausedAfter([[THREAD, FOUND]]);
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([prefixed]));
        expect(result.current.ask.answerSources).toHaveLength(2);
        expect(result.current.ask.answerSources[0]).toMatchObject({ title: "Renamed" });
        expect(ids(result.current.ask.answerSources)).toEqual([
            prefixed.entity_id,
            FOUND.entity_id,
        ]);
    });

    it("the same id of two kinds is two chips", () => {
        const { result } = pausedAfter([[source("task", "9"), source("note", "9")]]);
        expect(result.current.ask.answerSources).toHaveLength(2);
    });

    it("a source without an entity id is told apart by its content, not collapsed", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("q");
        });
        act(() => lastAsk().onSources([{ id: "a" }, { id: "b" }] as never));
        act(() => lastAsk().onSources([{ id: "a" }] as never));
        expect(result.current.ask.answerSources).toEqual([{ id: "a" }, { id: "b" }]);
    });
});

describe("a later copy of a source", () => {
    it("updates the chip where it is: the position stays, the newer data wins", () => {
        const { result } = pausedAfter([[THREAD, FOUND, LATER]]);
        act(() => result.current.onApprove());
        act(() =>
            lastDecide().onSources([
                { ...FOUND, title: "Fix login (renamed)", task_display_id: "PRJ-9" },
            ])
        );
        expect(ids(result.current.ask.answerSources)).toEqual([
            THREAD.entity_id,
            FOUND.entity_id,
            LATER.entity_id,
        ]);
        expect(result.current.ask.answerSources[1]).toMatchObject({
            title: "Fix login (renamed)",
            task_display_id: "PRJ-9",
        });
    });

    it("never erases what the earlier copy had: a blank field says nothing", () => {
        // A search hit pins the message it matched; the copy the server builds from ids
        // alone for a cited source (the back-fill of the final answer) does not.
        const hit = source("chat", "gm:9d3c:thread:4", {
            title: "Release thread",
            message_id: "m-17",
            thread_id: "4",
            matched_terms: ["release"],
        });
        const backfilled = source("chat", "gm:9d3c:thread:4", { title: "", thread_id: "4" });
        const { result } = pausedAfter([[hit]]);
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([backfilled]));
        expect(result.current.ask.answerSources).toEqual([hit]);
    });

    it("adds what the earlier copy lacked (a message to land on)", () => {
        const bare = source("chat", "gm:9d3c:thread:4", { title: "Release thread" });
        const { result } = pausedAfter([[bare]]);
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([{ ...bare, message_id: "m-17" }]));
        expect(result.current.ask.answerSources[0]).toMatchObject({ message_id: "m-17" });
    });
});

describe("a resumed leg does not reset the chips", () => {
    it("the decision itself changes none, and the list is the same array until something new arrives", () => {
        const { result } = pausedAfter([[THREAD, FOUND]]);
        const before = result.current.ask.answerSources;
        act(() => result.current.onApprove());
        expect(result.current.ask.answerSources).toBe(before);
        act(() =>
            lastDecide().onToolStart?.({ step: 2, tool_name: "create_task", arguments: {} })
        );
        act(() => lastDecide().onDelta("Working on it. "));
        expect(result.current.ask.answerSources).toBe(before);
    });

    it("same after a reject, and after the 422 that gives the approval card back", () => {
        const { result } = pausedAfter([[THREAD, FOUND]]);
        const before = result.current.ask.answerSources;
        act(() => result.current.onApprove({ title: "edited" }));
        act(() => lastDecide().onEditsRejected?.({ fieldErrors: { title: "too long" } }));
        expect(result.current.ask.pendingApproval).not.toBeNull();
        expect(result.current.ask.answerSources).toBe(before);
        act(() => result.current.onReject());
        expect(result.current.ask.answerSources).toBe(before);
    });
});

describe("a new ask starts from nothing", () => {
    it("the next ask of a conversation does not inherit the chips of the last turn", () => {
        const { result } = pausedAfter([[THREAD, FOUND]]);
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([CREATED]));
        act(() => lastDecide().onDone("sess-1", "run-p", 900));
        expect(result.current.ask.answerSources).toEqual([]);

        act(() => {
            result.current.onAsk("and now?");
        });
        expect(result.current.ask.answerSources).toEqual([]);
        act(() => lastAsk().onSources([LATER]));
        expect(ids(result.current.ask.answerSources)).toEqual([LATER.entity_id]);
        // The finished turn kept its own.
        expect(ids(result.current.turns[0].answerSources)).toEqual([
            THREAD.entity_id,
            FOUND.entity_id,
            CREATED.entity_id,
        ]);
    });

    it("an ask after a stored answer was shown does not inherit ITS chips (the live slot is not empty)", () => {
        const { result } = mount();
        act(() =>
            result.current.showStaticAnswer({
                askedQuery: "old",
                answer: "An old answer [x](task:9).",
                answerSources: [FOUND],
            })
        );
        expect(ids(result.current.ask.answerSources)).toEqual([FOUND.entity_id]);
        act(() => {
            result.current.onAsk("new question");
        });
        act(() => lastAsk().onSources([LATER]));
        expect(ids(result.current.ask.answerSources)).toEqual([LATER.entity_id]);
    });

    it("the same source in two consecutive turns is a chip of each", () => {
        const { result } = mount();
        for (const q of ["one", "two"]) {
            act(() => {
                result.current.onAsk(q);
            });
            act(() => lastAsk().onSources([FOUND]));
            act(() => lastAsk().onDone("sess-1", `run-${q}`, 10));
        }
        expect(result.current.turns.map((t) => ids(t.answerSources))).toEqual([
            [FOUND.entity_id],
            [FOUND.entity_id],
        ]);
    });
});

describe("an event that adds nothing", () => {
    it("a repeat of what the turn has changes nothing, and renders nothing", () => {
        const { result, probe } = pausedAfter([[THREAD, FOUND]]);
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([CREATED]));
        const state = result.current.ask;
        const list = state.answerSources;
        const renders = probe.renders;

        // The server's last event before `done`: same set, shipped as new objects.
        act(() => lastDecide().onSources(JSON.parse(JSON.stringify([CREATED]))));
        act(() => lastDecide().onSources([]));

        expect(result.current.ask).toBe(state);
        expect(result.current.ask.answerSources).toBe(list);
        expect(probe.renders).toBe(renders);
    });

    it("a re-ranked re-emit of the same set keeps the order the chips arrived in, and renders nothing", () => {
        const { result, probe } = pausedAfter([[THREAD, FOUND, LATER]]);
        const state = result.current.ask;
        const renders = probe.renders;
        // Re-ranked by citation: the cited ones first.
        act(() => lastAsk().onSources([LATER, FOUND, THREAD]));
        expect(result.current.ask).toBe(state);
        expect(probe.renders).toBe(renders);
        expect(ids(result.current.ask.answerSources)).toEqual([
            THREAD.entity_id,
            FOUND.entity_id,
            LATER.entity_id,
        ]);
    });

    it("an unchanged source keeps its object when another one is added", () => {
        const { result } = pausedAfter([[THREAD, FOUND]]);
        const [thread, found] = result.current.ask.answerSources;
        act(() => lastAsk().onSources([THREAD, FOUND, LATER]));
        const now = result.current.ask.answerSources;
        expect(now).toHaveLength(3);
        expect(now[0]).toBe(thread);
        expect(now[1]).toBe(found);
    });

    it("an event that adds something is a new state (the control of the two above)", () => {
        const { result, probe } = pausedAfter([[THREAD]]);
        const state = result.current.ask;
        const renders = probe.renders;
        act(() => lastAsk().onSources([THREAD, FOUND]));
        expect(result.current.ask).not.toBe(state);
        expect(probe.renders).toBeGreaterThan(renders);
    });
});

describe("the count onRunComplete reports", () => {
    it("is the chips of the whole turn, across the pause, not those of the last event", () => {
        const onRunComplete = vi.fn();
        const { result } = pausedAfter([[THREAD, FOUND]], { onRunComplete });
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([CREATED]));
        act(() => lastDecide().onSources([CREATED]));
        act(() => lastDecide().onDelta("Done."));
        act(() => lastDecide().onDone("sess-1", "run-p", 900));
        expect(onRunComplete).toHaveBeenCalledTimes(1);
        expect(onRunComplete.mock.calls[0][0].sourceCount).toBe(3);
    });

    it("counts a source sent twice once", () => {
        const onRunComplete = vi.fn();
        const { result } = mount({ onRunComplete });
        act(() => {
            result.current.onAsk("q");
        });
        act(() => lastAsk().onSources([FOUND]));
        act(() => lastAsk().onSources([FOUND, LATER]));
        act(() => lastAsk().onSources([LATER, FOUND]));
        act(() => lastAsk().onDone("sess-1", "run-1", 10));
        expect(onRunComplete.mock.calls[0][0].sourceCount).toBe(2);
    });

    it("starts again at zero for the next ask", () => {
        const onRunComplete = vi.fn();
        const { result } = mount({ onRunComplete });
        act(() => {
            result.current.onAsk("one");
        });
        act(() => lastAsk().onSources([FOUND, LATER]));
        act(() => lastAsk().onDone("sess-1", "run-1", 10));
        act(() => {
            result.current.onAsk("two");
        });
        act(() => lastAsk().onDone("sess-1", "run-2", 10));
        expect(onRunComplete.mock.calls.map((c) => c[0].sourceCount)).toEqual([2, 0]);
    });
});

describe("cancel and late events", () => {
    it("a turn cancelled after the decision promotes the union", () => {
        const onRunComplete = vi.fn();
        const { result } = pausedAfter([[THREAD, FOUND]], { onRunComplete });
        act(() => result.current.onApprove());
        act(() => lastDecide().onSources([CREATED]));
        act(() => result.current.onCancel());
        expect(result.current.turns).toHaveLength(1);
        expect(ids(result.current.turns[0].answerSources)).toEqual([
            THREAD.entity_id,
            FOUND.entity_id,
            CREATED.entity_id,
        ]);
        expect(onRunComplete).not.toHaveBeenCalled();
    });

    it("a turn cancelled at the pause promotes what the first leg had", () => {
        const { result } = pausedAfter([[THREAD, FOUND]]);
        act(() => result.current.onCancel());
        expect(ids(result.current.turns[0].answerSources)).toEqual([
            THREAD.entity_id,
            FOUND.entity_id,
        ]);
    });

    it("an event that arrives after the cancel is dropped", () => {
        const { result } = pausedAfter([[THREAD]]);
        act(() => result.current.onApprove());
        const resumed = lastDecide();
        act(() => result.current.onCancel());
        const state = result.current.ask;
        act(() => resumed.onSources([CREATED]));
        expect(result.current.ask).toBe(state);
        expect(result.current.ask.answerSources).toEqual([]);
        expect(result.current.turns[0].answerSources).toHaveLength(1);
    });

    it("an event of a superseded turn never reaches the next one", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("first");
        });
        const old = lastAsk();
        act(() => old.onSources([FOUND]));
        act(() => result.current.onCancel());
        act(() => {
            result.current.onAsk("second");
        });
        act(() => old.onSources([LATER]));
        expect(result.current.ask.answerSources).toEqual([]);
        act(() => lastAsk().onSources([THREAD]));
        expect(ids(result.current.ask.answerSources)).toEqual([THREAD.entity_id]);
    });

    it("an event that arrives after done is dropped too", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("q");
        });
        const stream = lastAsk();
        act(() => stream.onSources([FOUND]));
        act(() => stream.onDone("sess-1", "run-1", 10));
        const state = result.current.ask;
        act(() => stream.onSources([LATER]));
        expect(result.current.ask).toBe(state);
    });

    it("a reset to a history that ends at the live turn's own id still drops its late events", () => {
        // `reset` rewinds the turn counter to the restored history, so the id of the
        // aborted stream can come up again: the state alone cannot tell the two apart.
        const { result } = pausedAfter([[THREAD]]);
        const resumed = (act(() => result.current.onApprove()), lastDecide());
        act(() =>
            result.current.reset({
                sessionId: "sess-9",
                turns: [
                    {
                        id: 1,
                        askedQuery: "old",
                        answer: "old",
                        answerSources: [],
                        toolEvents: [],
                        askError: null,
                    },
                ],
            })
        );
        expect(result.current.ask.turnId).toBe(1);
        act(() => resumed.onSources([CREATED]));
        expect(result.current.ask.answerSources).toEqual([]);
    });

    it("a reset or a cleared conversation drops the chips of the live turn", () => {
        const { result } = pausedAfter([[THREAD, FOUND]]);
        const resumed = (act(() => result.current.onApprove()), lastDecide());
        act(() => result.current.reset({ sessionId: null, turns: [] }));
        act(() => resumed.onSources([CREATED]));
        expect(result.current.ask.answerSources).toEqual([]);
        act(() => result.current.clearConversation());
        act(() => resumed.onSources([CREATED]));
        expect(result.current.ask.answerSources).toEqual([]);
    });
});
