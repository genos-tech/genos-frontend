// Contract tests binding the agent NDJSON stream client to the canonical
// event vocabulary (src/services/agentEventNames.ts — KEEP IN SYNC with
// genos-api origin/search_engine/agent/events.py).
//
// Two directions (genos-docs spotlight/SPOTLIGHT_AGENT_CHANGE_SAFETY.md §4.3):
//   1. Behavioral — every canonical event, streamed through the real
//      askAgentStream/runNdjsonStream path, must reach its handler. A new
//      backend event added to the canonical list without frontend support
//      fails here (missing fixture) instead of shipping a dead UI.
//   2. Source-level — dispatchLine's `case "…"` labels must equal the
//      canonical set, so the client can't silently handle a vocabulary
//      the backend no longer speaks (or vice versa).
// Plus a negative control proving the tripwire actually trips: an
// unknown event type ends the stream "unexpectedly" → onError.

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { askAgentStream } from "../services/agentApi";
import { AGENT_EVENT_NAMES } from "../services/agentEventNames";

type Handlers = ReturnType<typeof makeHandlers>;

function makeHandlers() {
    return {
        onSources: vi.fn(),
        onDelta: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onToolError: vi.fn(),
        onPendingApproval: vi.fn(),
    };
}

// Minimal fetch response whose body streams the given events as NDJSON.
// Hand-rolled reader (not ReadableStream/Response) so the test doesn't
// depend on which web globals the jsdom environment ships.
function ndjsonResponse(events: unknown[]): Response {
    const payload = new TextEncoder().encode(events.map((e) => JSON.stringify(e) + "\n").join(""));
    let sent = false;
    return {
        ok: true,
        body: {
            getReader() {
                return {
                    read: async () =>
                        sent
                            ? { value: undefined, done: true as const }
                            : ((sent = true), { value: payload, done: false as const }),
                    releaseLock() {},
                };
            },
        },
    } as unknown as Response;
}

async function streamEvents(events: unknown[]): Promise<Handlers> {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ndjsonResponse(events))
    );
    const handlers = makeHandlers();
    await askAgentStream({
        query: "q",
        teamId: "team-1",
        accessToken: "token",
        ...handlers,
    });
    return handlers;
}

// One fixture per canonical event: a valid wire payload + the handler it
// must reach + whether the event terminates the stream (terminal events
// are `done`, `error`, `tool_call_pending_approval`; everything else is
// followed by a `done` so the stream closes cleanly).
const DONE = { type: "done", session_id: "s1", run_id: "r1" };
const FIXTURES: Record<
    (typeof AGENT_EVENT_NAMES)[number],
    { event: Record<string, unknown>; handler: keyof Handlers; terminal: boolean }
> = {
    sources: {
        event: { type: "sources", sources: [] },
        handler: "onSources",
        terminal: false,
    },
    answer_delta: {
        event: { type: "answer_delta", text: "hi" },
        handler: "onDelta",
        terminal: false,
    },
    done: { event: DONE, handler: "onDone", terminal: true },
    error: {
        event: { type: "error", message: "boom" },
        handler: "onError",
        terminal: true,
    },
    tool_call_start: {
        event: { type: "tool_call_start", step: 1, tool_name: "t", arguments: {} },
        handler: "onToolStart",
        terminal: false,
    },
    tool_call_result: {
        event: { type: "tool_call_result", step: 1, tool_name: "t", summary: "ok" },
        handler: "onToolResult",
        terminal: false,
    },
    tool_call_error: {
        event: { type: "tool_call_error", step: 1, tool_name: "t", error: "x" },
        handler: "onToolError",
        terminal: false,
    },
    tool_call_pending_approval: {
        event: {
            type: "tool_call_pending_approval",
            step: 1,
            tool_name: "t",
            arguments: {},
            approval_token: "tok",
            run_id: "r1",
        },
        handler: "onPendingApproval",
        terminal: true,
    },
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("agent NDJSON event contract", () => {
    it("has a fixture for every canonical event name", () => {
        // Fails when a new event lands in agentEventNames.ts without
        // frontend support — extend FIXTURES *and* agentApi.ts together.
        expect(Object.keys(FIXTURES).sort()).toEqual([...AGENT_EVENT_NAMES].sort());
    });

    it.each([...AGENT_EVENT_NAMES])("dispatches %s to its handler", async (name) => {
        const fixture = FIXTURES[name];
        const lines = fixture.terminal ? [fixture.event] : [fixture.event, DONE];
        const handlers = await streamEvents(lines);

        expect(handlers[fixture.handler]).toHaveBeenCalledTimes(1);
        if (name === "error") {
            expect(handlers.onError).toHaveBeenCalledWith("boom");
        } else {
            // Any onError here means the stream was treated as ending
            // unexpectedly — i.e. the client did NOT recognise the event.
            expect(handlers.onError).not.toHaveBeenCalled();
        }
    });

    it("passes the optional note ref through tool_call_result", async () => {
        // Approved create_note / update_note results carry a compact
        // `note` ref (id / type / changed_fields) that drives the note
        // cache refresh + Yjs body apply. Absent on other tools and on
        // older backends — both sides must tolerate undefined.
        const note = {
            note_id: 7,
            note_type: "personal",
            title: "Research",
            changed_fields: ["body"],
        };
        const handlers = await streamEvents([
            {
                type: "tool_call_result",
                step: 1,
                tool_name: "update_note",
                summary: "ok",
                note,
            },
            DONE,
        ]);
        expect(handlers.onToolResult).toHaveBeenCalledWith(
            expect.objectContaining({ tool_name: "update_note", note })
        );
    });

    it("negative control: an unknown event type trips the unexpected-end error", async () => {
        // Proves the mechanism the contract relies on: an event the client
        // doesn't know leaves the stream without a terminal event, which
        // surfaces as onError instead of silently succeeding.
        const handlers = await streamEvents([{ type: "some_future_event" }]);
        expect(handlers.onError).toHaveBeenCalledTimes(1);
        expect(handlers.onDone).not.toHaveBeenCalled();
    });

    it("dispatchLine case labels equal the canonical vocabulary", () => {
        // cwd-relative (vitest runs from the repo root): under the jsdom
        // environment `import.meta.url` is not a file:// URL.
        const source = readFileSync("src/services/agentApi.ts", "utf-8");
        const cases = [...source.matchAll(/case "([a-z_]+)":/g)].map((m) => m[1]);
        expect(new Set(cases)).toEqual(new Set(AGENT_EVENT_NAMES));
    });
});

// The /ask/ wire body must carry the active UI locale so the agent
// answers in the user's language (GENOS_CAPABILITY_ROADMAP §3.4). Before
// this the locale lived only in localStorage and never left the browser.
describe("ask request wire body", () => {
    // Each case owns the stored locale it asserts on — start from a
    // clean slate so a seeded value can't leak between them (or in from
    // another test in this file).
    beforeEach(() => window.localStorage.clear());

    const captureFetch = () => {
        const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
            Promise.resolve(ndjsonResponse([DONE]))
        );
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    };
    const sentLocale = (fetchMock: ReturnType<typeof captureFetch>) =>
        JSON.parse(fetchMock.mock.calls[0][1].body as string).locale;

    it("forwards the stored UI locale", async () => {
        window.localStorage.setItem("genos-locale", "ja");
        const fetchMock = captureFetch();
        await askAgentStream({
            query: "q",
            teamId: "team-1",
            accessToken: "token",
            ...makeHandlers(),
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(sentLocale(fetchMock)).toBe("ja");
    });

    it("always sends a valid locale even with nothing stored", async () => {
        // Falls back through the shared resolver (navigator → "en"), so
        // the field is never absent and the backend always has a signal.
        window.localStorage.clear();
        const fetchMock = captureFetch();
        await askAgentStream({
            query: "q",
            teamId: "team-1",
            accessToken: "token",
            ...makeHandlers(),
        });
        expect(["en", "ja", "es", "fr", "zh", "ar", "hi"]).toContain(sentLocale(fetchMock));
    });
});
