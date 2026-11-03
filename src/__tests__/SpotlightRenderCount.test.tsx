/**
 * Render budget of the Spotlight hook (render-storm follow-up).
 *
 * `useSpotlight` is called at the App ROOT, so every render of the hook is a
 * render of the whole app shell (and, unless they are frozen, of the
 * keep-alive Homes). The ask state machine used to be a private copy inside
 * this hook; folding it onto the shared `useAgentQA` must not add a single
 * render to a keystroke, and must not make the state or the callbacks that
 * the overlay hands to memoised children change identity while typing.
 *
 * The harness counts renders of the component that calls the hook (the same
 * thing App is) -- `renderHook`'s callback runs exactly once per render.
 *
 * The numbers pinned here are the ones measured on origin/main BEFORE the
 * refactor (0d592aa8); the test fails if the converged hook is worse.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSpotlight } from "../features/spotlight/useSpotlight";
import { askAgentStream } from "../services/agentApi";

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(async () => {}),
    decideAgent: vi.fn(async () => {}),
    fetchAgentSessionDetail: vi.fn(async () => null),
    fetchAgentSessions: vi.fn(async () => []),
    submitAgentFeedback: vi.fn(async () => true),
}));

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(() => new Promise(() => {})), // never lands: no result renders
}));

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

type Hook = ReturnType<typeof useSpotlight>;

const setup = (opts: { open?: boolean } = {}) => {
    let renders = 0;
    const view = renderHook(() => {
        renders += 1;
        return useSpotlight({ accessToken: "tok", teamId: "team-1" });
    });
    if (opts.open) act(() => view.result.current.open());
    return { ...view, renders: () => renders };
};

const KEYSTROKES = "what did we decide about the billing migration".split("");

const type = (view: ReturnType<typeof setup>) => {
    let text = "";
    for (const ch of KEYSTROKES) {
        text += ch;
        const next = text;
        act(() => view.result.current.setQuery(next));
    }
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

describe("Spotlight typing path render budget", () => {
    it("overlay closed: exactly one render per keystroke", () => {
        const view = setup();
        const before = view.renders();
        type(view);
        expect(view.renders() - before).toBe(KEYSTROKES.length);
    });

    it("overlay open (search armed, debounce pending): exactly one render per keystroke", () => {
        const view = setup({ open: true });
        const before = view.renders();
        type(view);
        expect(view.renders() - before).toBe(KEYSTROKES.length);
    });

    it("typing does not change the identity of the conversation state or of the actions", () => {
        const view = setup({ open: true });
        const first: Hook = view.result.current;
        type(view);
        const last: Hook = view.result.current;

        // The state the overlay's memoised children read.
        expect(last.ask).toBe(first.ask);
        expect(last.turns).toBe(first.turns);
        expect(last.results).toBe(first.results);
        // Everything that does not depend on the draft keeps its identity.
        // (`onAsk` reads the draft when called without an override, so it
        // legitimately follows `query`; that is the same on origin/main.)
        for (const key of [
            "open",
            "close",
            "onApprove",
            "onReject",
            "onCancel",
            "onNewConversation",
            "showStoredAnswer",
            "submitFeedback",
            "openHistory",
            "viewHistorySession",
            "backToHistoryList",
            "closeHistory",
            "resumeSession",
            "registerPageInputFocus",
            "onToggleFilterService",
            "onChangeFilterProjects",
        ] as const) {
            expect(last[key], key).toBe(first[key]);
        }
    });
});

describe("Spotlight streaming render budget", () => {
    it("a streamed answer costs one render per event, and two for the finish", () => {
        const view = setup({ open: true });
        act(() => view.result.current.onAsk("how is the sprint going?"));
        const args = vi.mocked(askAgentStream).mock.calls[0][0];

        const before = view.renders();
        for (let i = 0; i < 30; i += 1) act(() => args.onDelta(`word${i} `));
        expect(view.renders() - before).toBe(30);

        const beforeDone = view.renders();
        act(() => args.onDone("sess-1", "run-1"));
        // done: flip off streaming, then the promotion's own pass (the turn
        // is appended from inside the live-slot updater, which schedules a
        // second render). Measured on origin/main: 2.
        expect(view.renders() - beforeDone).toBeLessThanOrEqual(2);
    });

    it("sending a question is at most two renders (measured on origin/main: 2)", () => {
        const view = setup({ open: true });
        act(() => view.result.current.setQuery("hello"));
        const before = view.renders();
        act(() => view.result.current.onAsk());
        expect(view.renders() - before).toBeLessThanOrEqual(2);
    });
});
