/**
 * MIP-973: a FAILED request for the Genos conversation list must not read as
 * "you have no conversations".
 *
 * `fetchAgentSessions` used to turn every failure (a dropped connection, a 5xx
 * while a deploy rolls over the API) into `[]`, which its callers could not tell
 * from a real empty answer. So a refresh that failed emptied a list already on
 * screen, and a first load that failed said "You have no Genos conversations in
 * this team." — a claim about the person's data that nothing had checked.
 *
 * Nothing in agentApi is mocked here. Only `fetch` is faked, so each case covers
 * the whole path: request -> client -> hook -> what the surface shows. The four
 * surfaces that read the list are covered through their real owners:
 *   - the Genos page sidebar          (GenosHome -> useGenosSessions)
 *   - "What Genos remembers"          (ConversationsSection -> useGenosSessions)
 *   - the Cmd-K History panel         (useSpotlight.openHistory -> SpotlightContent)
 *
 * Same family as MIP-954 / MIP-961 (noteMetaFailedLoad, teamNoteFoldersFailedLoad):
 * a failure keeps what is on screen; only a successful answer replaces it.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { GenosHome } from "../features/genos/GenosHome";
import { ConversationsSection } from "../features/genos/memory/ConversationsSection";
import { useGenosSessions } from "../features/genos/useGenosSessions";
import { SpotlightContent } from "../features/spotlight/SpotlightContent";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { en } from "../i18n/locales/en";
import type { AgentSessionSummary } from "../services/agentApi";

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

// ---- HTTP, faked at fetch --------------------------------------------------

type Answer = () => Promise<unknown>;

const answerWith = (sessions: AgentSessionSummary[]): Answer => {
    return () => Promise.resolve({ ok: true, status: 200, json: async () => ({ sessions }) });
};
const answerWithStatus =
    (status: number): Answer =>
    () =>
        Promise.resolve({ ok: false, status, json: async () => ({}) });
// What a dropped connection looks like to fetch.
const offline: Answer = () => Promise.reject(new TypeError("Failed to fetch"));

let listAnswer: Answer = answerWith([]);
const listUrls: string[] = [];

const row = (id: string, firstQuery: string, over: Partial<AgentSessionSummary> = {}) => ({
    session_id: id,
    created_at: "2026-11-01T09:00:00Z",
    last_active_at: "2026-11-01T10:00:00Z",
    first_query: firstQuery,
    turn_count: 2,
    is_pinned: false,
    ...over,
});
const ROWS = [row("a", "what shipped last week?"), row("b", "summarize the auth thread")];

beforeEach(() => {
    listAnswer = answerWith([]);
    listUrls.length = 0;
    localStorage.clear();
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            if (url.includes("/agent/sessions/")) {
                listUrls.push(url);
                return listAnswer();
            }
            return { ok: false, status: 404, json: async () => ({}) };
        })
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

const EMPTY_MEMORY = en.settings.genosMemory.conversations.empty;
const RETRY = en.common.actions.retry;

// ---- useGenosSessions (the sidebar's and the memory page's list) ------------

describe("useGenosSessions: a failed request is not an empty list", () => {
    type Args = { accessToken: string | null; teamId: string; refreshKey: number };
    const mount = async (initial: Partial<Args> = {}) => {
        const hook = renderHook((args: Args) => useGenosSessions(args), {
            initialProps: { accessToken: "tok", teamId: "team-1", refreshKey: 0, ...initial },
        });
        await settle();
        return hook;
    };

    it.each([
        ["a 503", answerWithStatus(503)],
        ["a dropped connection", offline],
    ] as const)("keeps the rows on screen when a refresh gets %s", async (_name, failure) => {
        listAnswer = answerWith(ROWS);
        const hook = await mount();
        expect(hook.result.current.sessions.map((s) => s.session_id)).toEqual(["a", "b"]);

        listAnswer = failure;
        hook.rerender({ accessToken: "tok", teamId: "team-1", refreshKey: 1 });
        await settle();

        expect(listUrls).toHaveLength(2);
        expect(hook.result.current.sessions.map((s) => s.session_id)).toEqual(["a", "b"]);
        expect(hook.result.current.isLoading).toBe(false);
    });

    it("still clears the list when the server SAYS there are none", async () => {
        listAnswer = answerWith(ROWS);
        const hook = await mount();

        listAnswer = answerWith([]);
        hook.rerender({ accessToken: "tok", teamId: "team-1", refreshKey: 1 });
        await settle();

        expect(hook.result.current.sessions).toEqual([]);
        expect(hook.result.current.loadFailed).toBe(false);
    });

    it("reports a first load that failed, and a retry recovers", async () => {
        listAnswer = answerWithStatus(503);
        const hook = await mount();
        expect(hook.result.current.sessions).toEqual([]);
        expect(hook.result.current.isLoading).toBe(false);
        expect(hook.result.current.loadFailed).toBe(true);

        listAnswer = answerWith(ROWS);
        act(() => hook.result.current.reload());
        await settle();

        expect(listUrls).toHaveLength(2);
        expect(hook.result.current.sessions).toHaveLength(2);
        expect(hook.result.current.loadFailed).toBe(false);
    });

    it("does not say a successful empty first load failed", async () => {
        listAnswer = answerWith([]);
        const hook = await mount();
        expect(hook.result.current.sessions).toEqual([]);
        expect(hook.result.current.loadFailed).toBe(false);
    });

    it("clears the flag when a later refresh succeeds", async () => {
        listAnswer = answerWithStatus(500);
        const hook = await mount();
        expect(hook.result.current.loadFailed).toBe(true);

        listAnswer = answerWith(ROWS);
        hook.rerender({ accessToken: "tok", teamId: "team-1", refreshKey: 1 });
        await settle();
        expect(hook.result.current.loadFailed).toBe(false);
        expect(hook.result.current.sessions).toHaveLength(2);
    });

    it("never shows the previous team's rows when the NEW team's load fails", async () => {
        listAnswer = answerWith(ROWS);
        const hook = await mount();
        expect(hook.result.current.sessions).toHaveLength(2);

        listAnswer = answerWithStatus(503);
        hook.rerender({ accessToken: "tok", teamId: "team-2", refreshKey: 0 });
        await settle();

        expect(listUrls[1]).toContain("team_id=team-2");
        expect(hook.result.current.sessions).toEqual([]);
        expect(hook.result.current.loadFailed).toBe(true);
    });

    it("keeps the rows across a token refresh that fails (the list belongs to the team)", async () => {
        listAnswer = answerWith(ROWS);
        const hook = await mount();

        listAnswer = answerWithStatus(401);
        hook.rerender({ accessToken: "tok-2", teamId: "team-1", refreshKey: 0 });
        await settle();

        expect(listUrls).toHaveLength(2);
        expect(hook.result.current.sessions).toHaveLength(2);
    });

    it("does not leave the unfiltered rows up as the results of a search that failed", async () => {
        listAnswer = answerWith(ROWS);
        const hook = await mount();

        listAnswer = answerWithStatus(503);
        act(() => hook.result.current.setSearch("auth"));
        // The term is committed after the 250ms debounce.
        await waitFor(() => expect(listUrls).toHaveLength(2));
        await settle();

        expect(listUrls[1]).toContain("search=auth");
        expect(hook.result.current.sessions).toEqual([]);
        expect(hook.result.current.loadFailed).toBe(true);
    });
});

// ---- "What Genos remembers" -> Your Genos conversations ---------------------

describe("ConversationsSection: a failed load is an error with a retry, not an empty list", () => {
    const renderSection = () =>
        render(
            <CssVarsProvider>
                <ConversationsSection accessToken="tok" teamId="team-1" />
            </CssVarsProvider>
        );

    it.each([
        ["a 503", answerWithStatus(503)],
        ["a dropped connection", offline],
    ] as const)("says it could not load (%s) and offers a retry", async (_name, failure) => {
        listAnswer = failure;
        renderSection();

        expect(
            await screen.findByText(en.settings.genosMemory.conversations.loadFailed)
        ).toBeInTheDocument();
        expect(screen.queryByText(EMPTY_MEMORY)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: RETRY })).toBeInTheDocument();
        // Delete-all also reaches what the list can't show, so it stays.
        expect(
            screen.getByRole("button", {
                name: en.settings.genosMemory.conversations.deleteAll,
            })
        ).toBeEnabled();
    });

    it("retry fetches again and shows the conversations", async () => {
        listAnswer = answerWithStatus(503);
        renderSection();
        const retry = await screen.findByRole("button", { name: RETRY });

        listAnswer = answerWith(ROWS);
        await userEvent.click(retry);

        expect(await screen.findByText("what shipped last week?")).toBeInTheDocument();
        expect(screen.getByText("summarize the auth thread")).toBeInTheDocument();
        expect(
            screen.queryByText(en.settings.genosMemory.conversations.loadFailed)
        ).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: RETRY })).not.toBeInTheDocument();
    });

    it("a retry that fails again keeps the error up", async () => {
        listAnswer = answerWithStatus(503);
        renderSection();
        const retry = await screen.findByRole("button", { name: RETRY });

        await userEvent.click(retry);
        await waitFor(() => expect(listUrls).toHaveLength(2));

        expect(
            await screen.findByText(en.settings.genosMemory.conversations.loadFailed)
        ).toBeInTheDocument();
        expect(screen.queryByText(EMPTY_MEMORY)).not.toBeInTheDocument();
    });

    it("still says there are none when the server answers an empty list", async () => {
        listAnswer = answerWith([]);
        renderSection();

        expect(await screen.findByText(EMPTY_MEMORY)).toBeInTheDocument();
        expect(
            screen.queryByText(en.settings.genosMemory.conversations.loadFailed)
        ).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: RETRY })).not.toBeInTheDocument();
    });
});

// ---- The Genos page: sidebar fed by GenosHome -------------------------------

describe("Genos page sidebar: a failed load is an error with a retry, not an empty list", () => {
    // Wired the way App wires it: ONE useSpotlight instance feeding GenosHome,
    // which owns the sidebar's own useGenosSessions.
    const Page = ({ teamId = "team-1" }: { teamId?: string }) => {
        const spotlight = useSpotlight({ accessToken: "tok", teamId, isPageActive: true });
        return (
            <GenosHome
                accessToken="tok"
                spotlight={spotlight}
                teamId={teamId}
                onOpenSettings={vi.fn()}
                onPreview={vi.fn()}
                onSelect={vi.fn()}
            />
        );
    };
    const renderPage = (teamId?: string) =>
        render(
            <CssVarsProvider>
                <Page teamId={teamId} />
            </CssVarsProvider>
        );

    it("says it could not load history and offers a retry, instead of 'no conversations yet'", async () => {
        listAnswer = answerWithStatus(503);
        renderPage();

        expect(await screen.findByText(en.genos.sidebar.loadFailed)).toBeInTheDocument();
        expect(screen.queryByText(en.genos.sidebar.empty)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: RETRY })).toBeInTheDocument();
    });

    it("retry fetches again and fills the sidebar", async () => {
        listAnswer = offline;
        renderPage();
        const retry = await screen.findByRole("button", { name: RETRY });

        listAnswer = answerWith(ROWS);
        await userEvent.click(retry);

        expect(await screen.findByText("what shipped last week?")).toBeInTheDocument();
        expect(screen.queryByText(en.genos.sidebar.loadFailed)).not.toBeInTheDocument();
    });

    it("still shows the empty message when the server answers an empty list", async () => {
        listAnswer = answerWith([]);
        renderPage();

        expect(await screen.findByText(en.genos.sidebar.empty)).toBeInTheDocument();
        expect(screen.queryByText(en.genos.sidebar.loadFailed)).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: RETRY })).not.toBeInTheDocument();
    });

    it("a search that fails is an error, not 'no past asks match'", async () => {
        listAnswer = answerWith(ROWS);
        renderPage();
        await screen.findByText("what shipped last week?");

        listAnswer = answerWithStatus(503);
        fireEvent.change(screen.getByPlaceholderText(en.genos.sidebar.searchPlaceholder), {
            target: { value: "auth" },
        });

        expect(await screen.findByText(en.genos.sidebar.loadFailed)).toBeInTheDocument();
        expect(screen.queryByText(en.genos.sidebar.noMatches)).not.toBeInTheDocument();
        expect(screen.queryByText("what shipped last week?")).not.toBeInTheDocument();
    });

    it("a search that succeeds with nothing still says no past asks match", async () => {
        listAnswer = answerWith(ROWS);
        renderPage();
        await screen.findByText("what shipped last week?");

        listAnswer = answerWith([]);
        fireEvent.change(screen.getByPlaceholderText(en.genos.sidebar.searchPlaceholder), {
            target: { value: "zzz" },
        });

        expect(await screen.findByText(en.genos.sidebar.noMatches)).toBeInTheDocument();
        expect(screen.queryByText(en.genos.sidebar.loadFailed)).not.toBeInTheDocument();
    });
});

// ---- The Cmd-K History panel: useSpotlight.openHistory ----------------------

describe("useSpotlight.openHistory: a failed request is not an empty list", () => {
    const mount = (teamId = "team-1") =>
        renderHook(
            ({ team }: { team: string }) => useSpotlight({ accessToken: "tok", teamId: team }),
            {
                initialProps: { team: teamId },
            }
        );

    const open = async (hook: ReturnType<typeof mount>) => {
        act(() => hook.result.current.openHistory());
        await settle();
    };

    it.each([
        ["a 503", answerWithStatus(503)],
        ["a dropped connection", offline],
    ] as const)("keeps the rows when re-opening gets %s", async (_name, failure) => {
        listAnswer = answerWith(ROWS);
        const hook = mount();
        await open(hook);
        expect(hook.result.current.historySessions).toHaveLength(2);

        listAnswer = failure;
        await open(hook);

        expect(listUrls).toHaveLength(2);
        expect(hook.result.current.historySessions.map((s) => s.session_id)).toEqual(["a", "b"]);
        expect(hook.result.current.historyIsLoading).toBe(false);
    });

    it("still clears the rows when the server SAYS there are none", async () => {
        listAnswer = answerWith(ROWS);
        const hook = mount();
        await open(hook);

        listAnswer = answerWith([]);
        await open(hook);

        expect(hook.result.current.historySessions).toEqual([]);
        expect(hook.result.current.historyLoadFailed).toBe(false);
    });

    it("reports a first open that failed, and opening again recovers", async () => {
        listAnswer = answerWithStatus(503);
        const hook = mount();
        await open(hook);
        expect(hook.result.current.historyMode).toBe("list");
        expect(hook.result.current.historySessions).toEqual([]);
        expect(hook.result.current.historyLoadFailed).toBe(true);

        listAnswer = answerWith(ROWS);
        await open(hook);
        expect(hook.result.current.historySessions).toHaveLength(2);
        expect(hook.result.current.historyLoadFailed).toBe(false);
    });

    it("never shows the previous team's rows when the NEW team's load fails", async () => {
        listAnswer = answerWith(ROWS);
        const hook = mount("team-1");
        await open(hook);
        expect(hook.result.current.historySessions).toHaveLength(2);

        hook.rerender({ team: "team-2" });
        listAnswer = answerWithStatus(503);
        await open(hook);

        expect(listUrls[1]).toContain("team_id=team-2");
        expect(hook.result.current.historySessions).toEqual([]);
        expect(hook.result.current.historyLoadFailed).toBe(true);
    });

    it("lets a newer open win over an older one that fails late", async () => {
        const hook = mount();
        let failOld: () => void = () => {};
        listAnswer = () =>
            new Promise((_resolve, reject) => {
                failOld = () => reject(new TypeError("Failed to fetch"));
            });
        act(() => hook.result.current.openHistory());

        listAnswer = answerWith([]);
        await open(hook);
        expect(hook.result.current.historyLoadFailed).toBe(false);

        await act(async () => {
            failOld();
            await new Promise((r) => setTimeout(r, 0));
        });
        // The older request's failure is not allowed to turn a good (empty)
        // answer into an error, nor to clear the spinner of a newer one.
        expect(hook.result.current.historyLoadFailed).toBe(false);
    });
});

describe("History panel (overlay): a failed load is an error with a retry", () => {
    // The real hook behind the real panel; every other prop is inert.
    const Overlay = () => {
        const s = useSpotlight({ accessToken: "tok", teamId: "team-1" });
        return (
            <SpotlightContent
                aiAnswersEnabled={true}
                ask={{ ...EMPTY_ASK_STATE }}
                backToHistoryList={s.backToHistoryList}
                closeHistory={s.closeHistory}
                error={null}
                filterServices={[]}
                historyDetail={s.historyDetail}
                historyIsLoading={s.historyIsLoading}
                historyLoadFailed={s.historyLoadFailed}
                historyMode={s.historyMode}
                historySessions={s.historySessions}
                isLoading={false}
                openHistory={s.openHistory}
                query=""
                results={[]}
                turns={[]}
                variant="overlay"
                viewHistorySession={s.viewHistorySession}
                onApprove={vi.fn()}
                onAsk={vi.fn()}
                onCancel={vi.fn()}
                onNewConversation={vi.fn()}
                onOpenSettings={vi.fn()}
                onPreview={vi.fn()}
                onQueryChange={vi.fn()}
                onReject={vi.fn()}
                onSelect={vi.fn()}
                onToggleFilterService={vi.fn()}
            />
        );
    };
    const renderOverlay = () =>
        render(
            <CssVarsProvider>
                <Overlay />
            </CssVarsProvider>
        );
    const clickHistory = async () =>
        userEvent.click(screen.getByTestId("HistoryRoundedIcon").closest("button")!);

    it("says it could not load the list and offers a retry, instead of 'no past conversations'", async () => {
        listAnswer = answerWithStatus(503);
        renderOverlay();
        await clickHistory();

        expect(await screen.findByText(en.spotlight.history.listLoadFailed)).toBeInTheDocument();
        expect(screen.queryByText(en.spotlight.history.empty)).not.toBeInTheDocument();

        listAnswer = answerWith(ROWS);
        await userEvent.click(screen.getByRole("button", { name: RETRY }));
        expect(await screen.findByText("what shipped last week?")).toBeInTheDocument();
        expect(screen.queryByText(en.spotlight.history.listLoadFailed)).not.toBeInTheDocument();
    });

    it("keeps the list on screen when re-opening it fails", async () => {
        listAnswer = answerWith(ROWS);
        renderOverlay();
        await clickHistory();
        await screen.findByText("what shipped last week?");

        // The entry icon sits in the input row, which is hidden while the panel is
        // open, so re-opening means closing it first.
        listAnswer = offline;
        await userEvent.click(screen.getByTestId("CloseRoundedIcon").closest("button")!);
        await clickHistory();
        await waitFor(() => expect(listUrls).toHaveLength(2));
        await settle();

        expect(screen.getByText("what shipped last week?")).toBeInTheDocument();
        expect(screen.queryByText(en.spotlight.history.empty)).not.toBeInTheDocument();
        expect(screen.queryByText(en.spotlight.history.listLoadFailed)).not.toBeInTheDocument();
    });

    it("still says there are none when the server answers an empty list", async () => {
        listAnswer = answerWith([]);
        renderOverlay();
        await clickHistory();

        expect(await screen.findByText(en.spotlight.history.empty)).toBeInTheDocument();
        expect(screen.queryByText(en.spotlight.history.listLoadFailed)).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: RETRY })).not.toBeInTheDocument();
    });
});
