/**
 * The demo funnel: `demo_started` → `demo_completed`.
 *
 * The demo's whole purpose is that a visitor asks Genos something about a
 * workspace they've never seen and gets a cited answer back. So the thing
 * under test here is mostly *what counts* — every assertion below pins a
 * decision that, got wrong, produces a funnel that reports a number but
 * measures nothing:
 *
 *  1. **Arrival is not conversion.** Signing in and scrolling a chat is not
 *     experiencing the demo. If `demo_completed` fired on `navigate`, the
 *     funnel would report ~100% forever.
 *  2. **Only the FIRST answered ask converts.** A second question is
 *     engagement. Counting both would push completions above starts for the
 *     visitors who liked it most — exactly backwards.
 *  3. **A failed signin is not a funnel entry.** It gets its own event name;
 *     folding it into `demo_started` as `{failed: true}` would put
 *     non-entrants in step one and depress conversion by however many 429s
 *     the throttle served.
 *  4. **Errors and cancels do not convert.** A visitor who saw a stream error
 *     did not get the answer the demo exists to show.
 *  5. **Non-demo users emit nothing.** A real signed-up user asking a question
 *     is not a demo conversion.
 *  6. **No user content ships.** Same rule `useAnalyticsPageviews` follows for
 *     `?token=` and entity ids: the question text, the answer and the cited
 *     titles never leave the browser. This one is asserted directly against
 *     the captured properties, because a leak here is a privacy regression
 *     rather than a measurement one.
 *
 * `services/demoFunnel` is deliberately NOT mocked — only `analytics.capture`
 * at the very edge is. Mocking the funnel would mock away the sessionStorage
 * latch, which is the part with the interesting behaviour.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/AuthContext";
import { SignInForm } from "../features/admin/components/SignInForm";
import { demoSignIn } from "../features/admin/services/demoSignin";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { askAgentStream, decideAgent } from "../services/agentApi";
import { analytics } from "../services/analytics";
import { nonAuthApi } from "../services/api";
import { markDemoCompleted, markDemoStarted, resetDemoFunnel } from "../services/demoFunnel";

vi.mock("../services/analytics", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/analytics")>();
    return {
        ...actual,
        analytics: { ...actual.analytics, capture: vi.fn() },
    };
});

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(),
    decideAgent: vi.fn(),
    fetchAgentSessionDetail: vi.fn(async () => null),
    fetchAgentSessions: vi.fn(async () => []),
    fetchAgentUsage: vi.fn(async () => null),
    submitAgentFeedback: vi.fn(async () => true),
}));

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

vi.mock("../services/api", () => ({ nonAuthApi: vi.fn() }));

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

// `SignInForm` is rendered for real below, so its two side-effecting
// dependencies are stubbed: IndexedDB has no jsdom implementation, and the
// auth context would otherwise need a provider to hand back `setAccessToken`.
vi.mock("../db/utils", () => ({
    DatabaseUtils: { clearTeamScopedStores: vi.fn(async () => undefined) },
}));

vi.mock("../context/AuthContext", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../context/AuthContext")>()),
    useAuth: vi.fn(),
}));

const captured = () => vi.mocked(analytics.capture).mock.calls;
const eventsNamed = (name: string) => captured().filter(([event]) => event === name);
const propsOf = (name: string) => eventsNamed(name)[0]?.[1] as Record<string, unknown> | undefined;

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    resetDemoFunnel();
    vi.mocked(useAuth).mockReturnValue({ setAccessToken: vi.fn() } as never);
});

describe("demo funnel — what counts as an entry", () => {
    it("emits demo_started with the language the workspace actually got", () => {
        // The lang we POST is a preference; the server's echo is the authority
        // (an unknown code degrades to "en" there). Reporting our request
        // rather than the response would misattribute those visitors.
        markDemoStarted("ja");
        expect(eventsNamed("demo_started")).toHaveLength(1);
        expect(propsOf("demo_started")).toEqual({ lang: "ja" });
    });

    it("records a missing lang as server_default rather than guessing en", () => {
        // No `lang` in the response means an older API, or one that applied
        // its own Accept-Language chain. Both are worth being able to see;
        // silently writing "en" would hide them.
        markDemoStarted(undefined);
        expect(propsOf("demo_started")).toEqual({ lang: "server_default" });
    });

    it("does not count a rate-limited signin as a funnel entry", async () => {
        // The throttle is 10/hour/IP, so 429 is a routine outcome, not an
        // error. It must land in its own event: a visitor who never got a
        // workspace cannot convert, and putting them in step one would make
        // the funnel's drop-off indistinguishable from throttling.
        const post = vi.fn().mockRejectedValue({
            isAxiosError: true,
            response: { status: 429, data: {} },
        });
        vi.mocked(nonAuthApi).mockReturnValue({ post } as never);

        await demoSignIn();

        expect(eventsNamed("demo_started")).toHaveLength(0);
        expect(eventsNamed("demo_start_failed")).toHaveLength(1);
        expect(propsOf("demo_start_failed")).toEqual({ reason: "rate_limited" });
    });

    it("tells a network failure apart from a server failure", async () => {
        // Different problems, different owners: no `response` is the
        // visitor's connection, a 5xx is our seeder. One event name with one
        // reason property keeps both visible without inventing two events.
        const post = vi.fn().mockRejectedValue({ isAxiosError: true, message: "offline" });
        vi.mocked(nonAuthApi).mockReturnValue({ post } as never);
        await demoSignIn();
        expect(propsOf("demo_start_failed")).toEqual({ reason: "network" });

        vi.clearAllMocks();
        const post5xx = vi.fn().mockRejectedValue({
            isAxiosError: true,
            response: { status: 500, data: {} },
        });
        vi.mocked(nonAuthApi).mockReturnValue({ post: post5xx } as never);
        await demoSignIn();
        expect(propsOf("demo_start_failed")).toEqual({ reason: "error" });
    });

    it("emits nothing at all on a successful signin — the caller arms the funnel", async () => {
        // `demoSignIn` only reports FAILURES. The success event belongs at the
        // call site, after the workspace has been committed to storage: a
        // response that the caller then throws away is not an entry either.
        const post = vi.fn().mockResolvedValue({ data: { access: "t", team_id: "1" } });
        vi.mocked(nonAuthApi).mockReturnValue({ post } as never);
        await demoSignIn();
        expect(captured()).toHaveLength(0);
    });
});

describe("demo funnel — armed by the real Try-Demo button", () => {
    /**
     * The button is clicked for real rather than calling `markDemoStarted`
     * directly, because the call site is exactly what the rest of this file
     * cannot see: every conversion test above passes just as happily with the
     * `markDemoStarted` line deleted from `SignInForm`, which would ship a
     * funnel whose first step never fires.
     */
    const clickTryDemo = async (data: Record<string, unknown>) => {
        const post = vi.fn().mockResolvedValue({ data });
        vi.mocked(nonAuthApi).mockReturnValue({ post } as never);
        render(
            <CssVarsProvider>
                <MemoryRouter initialEntries={["/signin"]}>
                    <SignInForm />
                </MemoryRouter>
            </CssVarsProvider>
        );
        const button = await screen.findByRole("button", { name: /try with demo user/i });
        await act(async () => {
            button.click();
        });
        return post;
    };

    it("arms the funnel from the signin form, reporting the served language", async () => {
        await clickTryDemo({
            access: "t",
            username: "Demo User ab12",
            user_id: "9",
            team_id: "7",
            team_name: "Demo Team ab12",
            is_demo: true,
            lang: "ja",
        });

        await waitFor(() => expect(eventsNamed("demo_started")).toHaveLength(1));
        // The response's `lang`, not the app's locale: the POST is a
        // preference the server may not honour (an unknown code degrades to
        // "en"), and a visitor must be counted against the workspace they
        // actually got.
        expect(propsOf("demo_started")).toEqual({ lang: "ja" });
        // Armed means a subsequent ask can now convert.
        expect(markDemoCompleted({ origin: "typed" })).toBe(true);
    });

    it("does not arm the funnel when the signin fails", async () => {
        const post = vi.fn().mockRejectedValue({
            isAxiosError: true,
            response: { status: 429, data: {} },
        });
        vi.mocked(nonAuthApi).mockReturnValue({ post } as never);
        render(
            <CssVarsProvider>
                <MemoryRouter initialEntries={["/signin"]}>
                    <SignInForm />
                </MemoryRouter>
            </CssVarsProvider>
        );
        const button = await screen.findByRole("button", { name: /try with demo user/i });
        await act(async () => {
            button.click();
        });

        await waitFor(() => expect(eventsNamed("demo_start_failed")).toHaveLength(1));
        expect(eventsNamed("demo_started")).toHaveLength(0);
        // And the funnel stayed disarmed, so no later ask can convert.
        expect(markDemoCompleted({ origin: "typed" })).toBe(false);
    });
});

describe("demo funnel — what counts as a conversion", () => {
    it("ignores a completion for a session that never started", () => {
        // Every non-demo user in the app takes this path on every ask. It has
        // to be silent, or the funnel counts the whole user base.
        expect(markDemoCompleted({ origin: "typed" })).toBe(false);
        expect(captured()).toHaveLength(0);
    });

    it("converts once, and only once", () => {
        markDemoStarted("en");
        expect(markDemoCompleted({ origin: "starter", sourceCount: 4 })).toBe(true);
        // A second question is engagement, not a second conversion.
        expect(markDemoCompleted({ origin: "typed", sourceCount: 2 })).toBe(false);
        expect(eventsNamed("demo_completed")).toHaveLength(1);
        expect(propsOf("demo_completed")).toMatchObject({
            ask_origin: "starter",
            source_count: 4,
        });
    });

    it("reports a zero-citation answer rather than suppressing it", () => {
        // Zero is the interesting case: retrieval found nothing, so the demo
        // "completed" while failing at the thing it exists to demonstrate.
        // An `if (sourceCount)` guard would hide exactly that.
        markDemoStarted("en");
        markDemoCompleted({ origin: "typed", sourceCount: 0 });
        expect(propsOf("demo_completed")).toMatchObject({ source_count: 0 });
    });

    it("is a fresh funnel per visit, not per browser", () => {
        // sessionStorage, not localStorage: a visitor who comes back tomorrow
        // is a new entry. With localStorage their `demo_completed` would be
        // suppressed forever by a latch set on their first visit.
        markDemoStarted("en");
        markDemoCompleted({ origin: "typed" });
        expect(eventsNamed("demo_completed")).toHaveLength(1);

        sessionStorage.clear(); // a new tab / a later visit
        markDemoStarted("en");
        expect(markDemoCompleted({ origin: "typed" })).toBe(true);
        expect(eventsNamed("demo_completed")).toHaveLength(2);
    });

    it("carries no question text, answer text or entity id", () => {
        // The privacy convention `useAnalyticsPageviews` documents. Asserted
        // as an exact key set rather than a few `not.toContain` checks, so a
        // future property has to be added here deliberately.
        markDemoStarted("en");
        markDemoCompleted({ origin: "typed", elapsedMs: 9300, sourceCount: 3 });
        expect(Object.keys(propsOf("demo_completed") ?? {}).sort()).toEqual([
            "answer_elapsed_ms",
            "ask_origin",
            "source_count",
            "time_to_first_answer_ms",
        ]);
    });
});

describe("demo funnel — wired to the real ask", () => {
    const streamAnswer = (opts: { sources?: number; fail?: boolean } = {}) => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            if (opts.sources !== undefined) {
                args.onSources(
                    Array.from({ length: opts.sources }, (_, i) => ({
                        entity_type: "task",
                        entity_id: `task:${i}`,
                        title: `Task ${i}`,
                    })) as never
                );
            }
            if (opts.fail) {
                args.onError("the stream died");
                return;
            }
            args.onDelta("because the bundle budget was 120KB");
            args.onDone("sess-1", "run-1", 9300);
        });
    };

    it("converts on the first answered ask, carrying the timing and citation count", async () => {
        markDemoStarted("en");
        streamAnswer({ sources: 3 });

        const { result } = renderHook(() => useSpotlight({ accessToken: "t", teamId: "team-1" }));
        act(() => result.current.onAsk("why did we reject framer-motion?"));

        await waitFor(() => expect(eventsNamed("demo_completed")).toHaveLength(1));
        expect(propsOf("demo_completed")).toMatchObject({
            ask_origin: "typed",
            answer_elapsed_ms: 9300,
            // Mirrored from `onSources` on purpose: `onDone` runs before that
            // state update is readable from a handler closure, so reading
            // `ask.answerSources` there reports 0 on every single answer.
            source_count: 3,
        });
    });

    it("distinguishes a starter chip from a typed question", async () => {
        // This is the measurement the starter prompts were added to enable:
        // whether the chips are what get visitors to their first answer.
        // `overrideQuery !== undefined` cannot answer it — retry supplies one
        // too — so the origin has to travel explicitly.
        markDemoStarted("en");
        streamAnswer({ sources: 1 });

        const { result } = renderHook(() => useSpotlight({ accessToken: "t", teamId: "team-1" }));
        act(() => result.current.onAsk("What changed this week?", undefined, "starter"));

        await waitFor(() => expect(eventsNamed("demo_completed")).toHaveLength(1));
        expect(propsOf("demo_completed")).toMatchObject({ ask_origin: "starter" });
    });

    it("does not convert when the stream errors", async () => {
        // A visitor who watched it fail did not experience the demo. Counting
        // them would make the funnel look healthiest when the agent is broken.
        markDemoStarted("en");
        streamAnswer({ fail: true });

        const { result } = renderHook(() => useSpotlight({ accessToken: "t", teamId: "team-1" }));
        act(() => result.current.onAsk("anything"));

        await waitFor(() => expect(result.current.turns).toHaveLength(1));
        expect(eventsNamed("demo_completed")).toHaveLength(0);
    });

    it("does not convert for a normal signed-up user asking a question", async () => {
        // No `markDemoStarted` — the funnel was never armed. This is the path
        // every real user takes, so it is the one that must stay silent.
        streamAnswer({ sources: 2 });

        const { result } = renderHook(() => useSpotlight({ accessToken: "t", teamId: "team-1" }));
        act(() => result.current.onAsk("what is blocked?"));

        await waitFor(() => expect(result.current.turns).toHaveLength(1));
        expect(captured()).toHaveLength(0);
    });

    it("survives an approval pause, keeping the origin across the resume", async () => {
        // The demo story's finale is an approval-gated write ("break the
        // remaining animation work into tasks"), so the conversion lands on a
        // RESUMED stream, not the first one. It works because `decide`
        // deliberately does not bump `turnId` — approve/reject continues the
        // same turn — which is exactly what keeps the origin mirror valid.
        // Had it minted a new id, `maybeCompleteDemoFunnel`'s identity check
        // would reject the resumed `onDone` and the demo's most impressive
        // moment would be the one the funnel never counted.
        markDemoStarted("en");
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onSources([
                { entity_type: "task", entity_id: "task:1", title: "Task 1" },
            ] as never);
            args.onPendingApproval?.({
                step: 1,
                tool_name: "create_task_plan",
                arguments: {},
                approval_token: "tok",
                run_id: "run-9",
            });
        });
        vi.mocked(decideAgent).mockImplementation(async (args) => {
            args.onDelta("created 3 tasks");
            args.onDone("sess-1", "run-9", 4200);
        });

        const { result } = renderHook(() => useSpotlight({ accessToken: "t", teamId: "team-1" }));
        act(() =>
            result.current.onAsk("break the animation work into tasks", undefined, "starter")
        );

        await waitFor(() => expect(result.current.ask.pendingApproval).not.toBeNull());
        // Paused is not finished: nothing has converted yet.
        expect(eventsNamed("demo_completed")).toHaveLength(0);

        act(() => result.current.onApprove());

        await waitFor(() => expect(eventsNamed("demo_completed")).toHaveLength(1));
        expect(propsOf("demo_completed")).toMatchObject({
            ask_origin: "starter",
            answer_elapsed_ms: 4200,
            source_count: 1,
        });
    });
});
