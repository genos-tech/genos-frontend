/**
 * "Ask Genos about a chat message or a selected passage" (MIP-1058, genos-api AGENT_PARITY_TOOLS):
 * the client half that every entry point shares.
 *
 *   - the `message` mention on the wire (`message_id` is the v3 UUID, never the sequence number)
 *   - the two optional request fields `selected_text` / `selected_from` (cut at the server's 4,000
 *     characters, absent unless the text has something in it, the source never alone)
 *   - the terminal `done` event's `dropped_references`, as a clean list
 *   - the sentences it becomes (never "could not read"; "some of the messages" for more than one)
 *
 * Everything here is inert with the server flag off: the server ignores the fields, no 4xx.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
    clipSelectionText,
    makeAskSelection,
    SELECTED_TEXT_MAX,
    toWireSelection,
} from "../features/agentQA/askSelection";
import {
    countMessageMentions,
    droppedReferenceNotices,
    type DroppedLabels,
} from "../features/agentQA/droppedReferences";
import {
    mentionKey,
    toWireMentions,
    type AgentMentionRef,
} from "../features/agentQA/mentions/types";
import { asDroppedReferences, askAgentStream } from "../services/agentApi";

const UUID = "5b0c3a52-6a31-4f1a-9a30-0e7f4a8f1c11";
const OTHER = "9d3a1b64-2c57-4c0e-8b5e-3f1a2b6c7d88";
const MESSAGE: AgentMentionRef = { kind: "message", messageId: UUID, label: "Alice 14:02" };

describe("the message mention", () => {
    it("is sent as {type, message_id, label} with the v3 uuid", () => {
        expect(toWireMentions([MESSAGE])).toEqual([
            { type: "message", message_id: UUID, label: "Alice 14:02" },
        ]);
    });

    it("is keyed by the uuid alone, so two messages never collapse and one is not listed twice", () => {
        expect(mentionKey(MESSAGE)).toBe(`message:${UUID}`);
        expect(mentionKey({ ...MESSAGE, messageId: OTHER })).not.toBe(mentionKey(MESSAGE));
        expect(mentionKey({ ...MESSAGE, label: "another label" })).toBe(mentionKey(MESSAGE));
    });
});

describe("the selection", () => {
    it("the cap is the server's: 4,000", () => {
        expect(SELECTED_TEXT_MAX).toBe(4000);
    });

    it("cuts at 4,000 code points and says it cut", () => {
        const long = "a".repeat(SELECTED_TEXT_MAX + 25);
        const { text, truncated } = clipSelectionText(long);
        expect(Array.from(text)).toHaveLength(SELECTED_TEXT_MAX);
        expect(truncated).toBe(true);
        expect(clipSelectionText("a".repeat(SELECTED_TEXT_MAX)).truncated).toBe(false);
    });

    it("counts code points, so an emoji is never split in half", () => {
        // 3,999 letters + 5 emoji: 4,004 code points (8,013 UTF-16 units). Cut at 4,000 = 3,999 + 1.
        const text = "a".repeat(SELECTED_TEXT_MAX - 1) + "😀".repeat(5);
        const clipped = clipSelectionText(text);
        expect(clipped.truncated).toBe(true);
        expect(Array.from(clipped.text)).toHaveLength(SELECTED_TEXT_MAX);
        expect(clipped.text.endsWith("😀")).toBe(true);
        // No lone surrogate left at the cut.
        expect(clipped.text).not.toMatch(
            /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
        );
    });

    it("trims, and treats a blank passage as no selection", () => {
        expect(clipSelectionText("  hello \n").text).toBe("hello");
        expect(makeAskSelection("   \n\t ")).toBeNull();
        expect(toWireSelection(null)).toEqual({});
        expect(toWireSelection({ text: "  " })).toEqual({});
    });

    it("sends selected_text, and selected_from as a mention-shaped object", () => {
        const selection = makeAskSelection("what Alice said", MESSAGE);
        expect(toWireSelection(selection)).toEqual({
            selected_text: "what Alice said",
            selected_from: { type: "message", message_id: UUID, label: "Alice 14:02" },
        });
    });

    it("sends no selected_from when the passage has no source", () => {
        expect(toWireSelection(makeAskSelection("a passage"))).toEqual({
            selected_text: "a passage",
        });
    });

    it("never offers a person or a group as the source: the server would drop it", () => {
        const person: AgentMentionRef = { kind: "user", userId: "u1", label: "Alice" };
        const group: AgentMentionRef = { kind: "group", groupId: 3, label: "Design" };
        expect(makeAskSelection("text", person)).toEqual({ text: "text" });
        expect(toWireSelection({ text: "text", from: group })).toEqual({ selected_text: "text" });
    });

    it("remembers that the text was cut, for the member, but never sends that", () => {
        const selection = makeAskSelection("x".repeat(SELECTED_TEXT_MAX + 1), MESSAGE);
        expect(selection?.truncated).toBe(true);
        expect(JSON.stringify(toWireSelection(selection))).not.toContain("truncated");
    });
});

// --- the request body -------------------------------------------------------------------------

const handlers = () => ({
    onSources: vi.fn(),
    onDelta: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
});

/** An NDJSON response made of `events`, read by the same reader the real stream uses. */
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

const ask = async (
    extra: Partial<Parameters<typeof askAgentStream>[0]> = {},
    events: unknown[] = [{ type: "done", session_id: "s1", run_id: "r1" }]
) => {
    const fetchMock = vi.fn(async () => ndjson(events));
    vi.stubGlobal("fetch", fetchMock);
    const h = handlers();
    await askAgentStream({
        query: "what did she mean?",
        teamId: "team-1",
        accessToken: "tok",
        ...h,
        ...extra,
    });
    const body = JSON.parse(
        (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
    );
    return { body, h };
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("POST /agent/ask/ with a message and a selection", () => {
    it("an ordinary ask has neither field: the body is what it was", async () => {
        const { body } = await ask();
        expect(Object.keys(body).sort()).toEqual(["locale", "query", "team_id"]);
    });

    it("carries the message mention verbatim", async () => {
        const { body } = await ask({ mentions: toWireMentions([MESSAGE]) });
        expect(body.mentions).toEqual([
            { type: "message", message_id: UUID, label: "Alice 14:02" },
        ]);
    });

    it("carries selected_text and selected_from", async () => {
        const { body } = await ask({
            selectedText: "the passage",
            selectedFrom: { type: "message", message_id: UUID, label: "Alice 14:02" },
        });
        expect(body.selected_text).toBe("the passage");
        expect(body.selected_from).toEqual({
            type: "message",
            message_id: UUID,
            label: "Alice 14:02",
        });
    });

    it("sends no selected_from without selected_text: the server ignores it, so the client never does", async () => {
        const { body } = await ask({
            selectedText: "   ",
            selectedFrom: { type: "message", message_id: UUID, label: "x" },
        });
        expect(body).not.toHaveProperty("selected_text");
        expect(body).not.toHaveProperty("selected_from");
    });

    it("cuts what it sends at 4,000 characters, whoever called", async () => {
        const { body } = await ask({ selectedText: "z".repeat(SELECTED_TEXT_MAX + 500) });
        expect(Array.from(body.selected_text as string)).toHaveLength(SELECTED_TEXT_MAX);
    });
});

// --- done.dropped_references ------------------------------------------------------------------

describe("done.dropped_references", () => {
    it("reaches onDone as the fourth argument", async () => {
        const { h } = await ask({}, [
            {
                type: "done",
                session_id: "s1",
                run_id: "r1",
                elapsed_ms: 9,
                dropped_references: ["message", "selection"],
            },
        ]);
        expect(h.onDone).toHaveBeenCalledWith("s1", "r1", 9, ["message", "selection"]);
    });

    it("is absent when nothing was dropped: onDone is called exactly as before", async () => {
        const { h } = await ask();
        expect(h.onDone).toHaveBeenCalledTimes(1);
        expect(h.onDone.mock.calls[0]).toHaveLength(3);
    });

    it("keeps only the kinds this client knows, once each, in the server's order", () => {
        expect(
            asDroppedReferences(["selected_from", "message", "message", "mystery", 7, null])
        ).toEqual(["selected_from", "message"]);
        expect(asDroppedReferences(["mystery"])).toBeUndefined();
        expect(asDroppedReferences([])).toBeUndefined();
        expect(asDroppedReferences("message")).toBeUndefined();
        expect(asDroppedReferences(undefined)).toBeUndefined();
    });
});

// --- the sentences ----------------------------------------------------------------------------

const LABELS: DroppedLabels = {
    message: "ONE-MESSAGE",
    messages: "SOME-MESSAGES",
    selection: "SELECTION",
    selectedFrom: "SELECTED-FROM",
    task: "TASK",
};
const M1: AgentMentionRef = { kind: "message", messageId: UUID, label: "a" };
const M2: AgentMentionRef = { kind: "message", messageId: OTHER, label: "b" };
const TASK: AgentMentionRef = { kind: "task", taskId: 1, label: "t" };

describe("the notice sentences", () => {
    it("says nothing when nothing was dropped", () => {
        expect(droppedReferenceNotices(undefined, [M1], LABELS)).toEqual([]);
        expect(droppedReferenceNotices([], [M1], LABELS)).toEqual([]);
    });

    it("says 'the message' for one message and 'some of the messages' for more than one", () => {
        expect(droppedReferenceNotices(["message"], [M1], LABELS)).toEqual(["ONE-MESSAGE"]);
        expect(droppedReferenceNotices(["message"], [M1, M2], LABELS)).toEqual(["SOME-MESSAGES"]);
        // Past the server's limit of 3 everything can resolve and "message" still comes back.
        const five = Array.from(
            { length: 5 },
            (_, i): AgentMentionRef => ({
                kind: "message",
                messageId: `id-${i}`,
                label: `m${i}`,
            })
        );
        expect(droppedReferenceNotices(["message"], five, LABELS)).toEqual(["SOME-MESSAGES"]);
    });

    it("counts only messages, and each message once", () => {
        expect(countMessageMentions([M1, TASK, TASK])).toBe(1);
        expect(countMessageMentions([M1, { ...M1, label: "again" }])).toBe(1);
        expect(countMessageMentions([M1, M2, TASK])).toBe(2);
        expect(countMessageMentions(undefined)).toBe(0);
    });

    it("maps each kind to its own sentence, in the server's order", () => {
        expect(droppedReferenceNotices(["selection"], undefined, LABELS)).toEqual(["SELECTION"]);
        expect(droppedReferenceNotices(["selected_from"], undefined, LABELS)).toEqual([
            "SELECTED-FROM",
        ]);
        expect(
            droppedReferenceNotices(["selected_from", "message", "selection"], [M1], LABELS)
        ).toEqual(["SELECTED-FROM", "ONE-MESSAGE", "SELECTION"]);
    });
});
