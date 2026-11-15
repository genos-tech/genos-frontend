/**
 * `dropped_references` on a run that pauses for approval (MIP-1585, genos-api #879, behind the
 * server's `AGENT_PARITY_TOOLS` flag): the client half.
 *
 * The server now says what the ask could not use on THREE events, not one: the `done` of an
 * /ask/ (MIP-1058, as before), the approval card's `tool_call_pending_approval`, and the `done` of
 * the resumed /decide/ leg, which also adds what the decision could not read again. A new kind,
 * `"task"`, is the task or milestone the conversation is about.
 *
 *   - the card's list reaches `onPendingApproval` as a SECOND argument, only when it has something
 *     in it (the card itself, the first argument, is unchanged, so no existing caller notices)
 *   - the resumed `done` already reached `onDone`; `"task"` is now a kind this client knows
 *   - an unknown kind is ignored, on the card and on the `done`
 *   - the union of an earlier list and a later one, each kind once, in the order it first came
 *   - the sentence for `"task"`, and never a sentence for a kind that is not one
 *
 * With the server flag off none of these fields is sent, and every assertion about "absent" below
 * is what the client then sees.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
    droppedReferenceNotices,
    mergeDroppedReferences,
    type DroppedLabels,
} from "../features/agentQA/droppedReferences";
import {
    asDroppedReferences,
    askAgentStream,
    decideAgent,
    DROPPED_REFERENCES,
    type DroppedReference,
} from "../services/agentApi";

afterEach(() => {
    vi.unstubAllGlobals();
});

const ndjson = (events: unknown[]): Response => {
    const payload = new TextEncoder().encode(events.map((e) => JSON.stringify(e) + "\n").join(""));
    let sent = false;
    return {
        ok: true,
        body: {
            getReader: () => ({
                read: async () =>
                    sent
                        ? { value: undefined, done: true as const }
                        : ((sent = true), { value: payload, done: false as const }),
                releaseLock() {},
            }),
        },
    } as unknown as Response;
};

const handlers = () => ({
    onSources: vi.fn(),
    onDelta: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    onPendingApproval: vi.fn(),
});

const CARD = {
    type: "tool_call_pending_approval",
    step: 1,
    tool_name: "add_comment",
    arguments: { task_id: 7, body: "hi" },
    editable: ["body"],
    approval_token: "ap-1",
    run_id: "run-1",
};

/** The ask streams `events`; the handlers see what the real stream parser makes of them. */
const ask = async (events: unknown[]) => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ndjson(events))
    );
    const h = handlers();
    await askAgentStream({ query: "q", teamId: "team-1", accessToken: "tok", ...h });
    return h;
};

/** The resumed leg of a decision, the same way. */
const decide = async (events: unknown[]) => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ndjson(events))
    );
    const h = handlers();
    await decideAgent({
        runId: "run-1",
        approvalToken: "ap-1",
        decision: "approve",
        accessToken: "tok",
        ...h,
    });
    return h;
};

describe("the approval card's dropped_references", () => {
    it("reaches onPendingApproval as the second argument, the card as the first", async () => {
        const h = await ask([{ ...CARD, dropped_references: ["message"] }]);
        expect(h.onPendingApproval).toHaveBeenCalledTimes(1);
        const [card, dropped] = h.onPendingApproval.mock.calls[0];
        expect(dropped).toEqual(["message"]);
        // The kinds belong to the run, not to the card: the card is what it always was.
        expect(card).not.toHaveProperty("dropped_references");
        expect(card.approval_token).toBe("ap-1");
        expect(card.run_id).toBe("run-1");
    });

    it("carries every kind the server named, once each, in its order", async () => {
        const h = await ask([
            { ...CARD, dropped_references: ["selection", "message", "selection", "task"] },
        ]);
        expect(h.onPendingApproval.mock.calls[0][1]).toEqual(["selection", "message", "task"]);
    });

    it("is absent with the flag off: the handler gets the card alone, as before", async () => {
        const h = await ask([CARD]);
        expect(h.onPendingApproval).toHaveBeenCalledTimes(1);
        expect(h.onPendingApproval.mock.calls[0]).toHaveLength(1);
    });

    it("ignores a kind it does not know, and an empty or malformed list says nothing", async () => {
        for (const raw of [["mystery"], [], "message", null, 7, { 0: "message" }]) {
            const h = await ask([{ ...CARD, dropped_references: raw }]);
            expect(h.onPendingApproval.mock.calls[0], JSON.stringify(raw)).toHaveLength(1);
        }
    });

    it("keeps the kinds it knows when the list also holds one it does not", async () => {
        const h = await ask([{ ...CARD, dropped_references: ["mystery", "message", 3] }]);
        expect(h.onPendingApproval.mock.calls[0][1]).toEqual(["message"]);
    });

    it("still closes the stream cleanly: a card with the field is a terminal event too", async () => {
        const h = await ask([{ ...CARD, dropped_references: ["message"] }]);
        expect(h.onError).not.toHaveBeenCalled();
    });
});

describe("the resumed leg's done", () => {
    it("carries a lost task to onDone as the fourth argument", async () => {
        const h = await decide([
            { type: "done", session_id: "s1", run_id: "run-1", dropped_references: ["task"] },
        ]);
        expect(h.onDone).toHaveBeenCalledWith("s1", "run-1", undefined, ["task"]);
    });

    it("carries what the ask dropped and what the decision lost, together", async () => {
        const h = await decide([
            {
                type: "done",
                session_id: "s1",
                run_id: "run-1",
                elapsed_ms: 40,
                dropped_references: ["selection", "message", "task"],
            },
        ]);
        expect(h.onDone).toHaveBeenCalledWith("s1", "run-1", 40, ["selection", "message", "task"]);
    });

    it("ignores a kind it does not know", async () => {
        const h = await decide([
            { type: "done", session_id: "s1", run_id: "run-1", dropped_references: ["thread"] },
        ]);
        expect(h.onDone).toHaveBeenCalledTimes(1);
        expect(h.onDone.mock.calls[0]).toHaveLength(3);
    });

    it("is absent with nothing dropped: onDone is called as before", async () => {
        const h = await decide([{ type: "done", session_id: "s1", run_id: "run-1" }]);
        expect(h.onDone.mock.calls[0]).toHaveLength(3);
    });

    it("a leg that pauses again puts the same field on its second card", async () => {
        const h = await decide([
            { ...CARD, approval_token: "ap-2", dropped_references: ["task"] },
        ]);
        expect(h.onPendingApproval.mock.calls[0][1]).toEqual(["task"]);
        expect(h.onPendingApproval.mock.calls[0][0].approval_token).toBe("ap-2");
    });
});

describe("the kinds this client knows", () => {
    it("are the server's four", () => {
        expect([...DROPPED_REFERENCES].sort()).toEqual(
            ["message", "selected_from", "selection", "task"].sort()
        );
    });

    it("includes task, which asDroppedReferences keeps", () => {
        expect(asDroppedReferences(["task"])).toEqual(["task"]);
        expect(asDroppedReferences(["mystery", "task"])).toEqual(["task"]);
    });
});

describe("mergeDroppedReferences", () => {
    it("is the union, each kind once, in the order it first came", () => {
        expect(mergeDroppedReferences(["message"], ["message", "task"])).toEqual([
            "message",
            "task",
        ]);
        expect(mergeDroppedReferences(["selection"], ["message"])).toEqual([
            "selection",
            "message",
        ]);
        expect(mergeDroppedReferences(["task", "message"], ["message", "selection"])).toEqual([
            "task",
            "message",
            "selection",
        ]);
    });

    it("has no duplicate when the card and the done carry the same list", () => {
        const kinds: DroppedReference[] = ["selection", "message"];
        expect(mergeDroppedReferences(kinds, [...kinds])).toEqual(["selection", "message"]);
    });

    it("takes the later list alone when there is no earlier one, and the earlier alone when the later has nothing", () => {
        expect(mergeDroppedReferences(undefined, ["message"])).toEqual(["message"]);
        expect(mergeDroppedReferences(["message"], undefined)).toEqual(["message"]);
        expect(mergeDroppedReferences(["message"], [])).toEqual(["message"]);
        expect(mergeDroppedReferences(undefined, undefined)).toBeUndefined();
        expect(mergeDroppedReferences(undefined, [])).toBeUndefined();
    });

    it("hands back the earlier list itself when nothing is added, so state does not change", () => {
        const earlier: DroppedReference[] = ["message"];
        expect(mergeDroppedReferences(earlier, ["message"])).toBe(earlier);
        expect(mergeDroppedReferences(earlier, undefined)).toBe(earlier);
    });

    it("never changes either list it was given", () => {
        const earlier: DroppedReference[] = ["message"];
        const later: DroppedReference[] = ["task", "message"];
        mergeDroppedReferences(earlier, later);
        expect(earlier).toEqual(["message"]);
        expect(later).toEqual(["task", "message"]);
    });
});

const LABELS: DroppedLabels = {
    message: "ONE-MESSAGE",
    messages: "SOME-MESSAGES",
    selection: "SELECTION",
    selectedFrom: "SELECTED-FROM",
    task: "TASK",
};

describe("the sentence for a lost task", () => {
    it("is the task sentence, and only that", () => {
        expect(droppedReferenceNotices(["task"], undefined, LABELS)).toEqual(["TASK"]);
    });

    it("does not depend on how many messages the turn pointed at", () => {
        const m = (id: string) => ({ kind: "message" as const, messageId: id, label: id });
        expect(droppedReferenceNotices(["task"], [m("a"), m("b")], LABELS)).toEqual(["TASK"]);
    });

    it("sits beside the others, in the server's order", () => {
        expect(
            droppedReferenceNotices(["selection", "message", "task"], undefined, LABELS)
        ).toEqual(["SELECTION", "ONE-MESSAGE", "TASK"]);
    });

    it("says nothing for a kind it does not know, even if one is handed in", () => {
        const unknown = ["mystery", "task"] as unknown as DroppedReference[];
        expect(droppedReferenceNotices(unknown, undefined, LABELS)).toEqual(["TASK"]);
        expect(
            droppedReferenceNotices(["mystery" as DroppedReference], undefined, LABELS)
        ).toEqual([]);
    });
});
