/**
 * "What Genos remembers": the page that shows what Genos draws on and lets a
 * person delete it.
 *
 * Built against genos-api #553 / #554 (conversation delete, shared answers,
 * the sharing preference). Every network edge is mocked here, so these pin
 * the CLIENT's side of that contract: which request each button sends, what
 * the page does with each answer the server can give (200, 404, 409, other),
 * and that nothing on screen claims a state the server did not confirm.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    AGENT_SESSIONS_DELETED_EVENT,
    type AgentSessionsDeletedDetail,
} from "../features/agentQA/sessionEvents";
import { GenosMemoryPage } from "../features/genos/memory/GenosMemoryPage";
import {
    deleteAgentSession,
    deleteAllAgentSessions,
    fetchAgentSessions,
    fetchSharedAnswers,
    withdrawSharedAnswer,
    type AgentSessionSummary,
    type SharedAnswer,
} from "../services/agentApi";

const apiGet = vi.fn();
const apiPatch = vi.fn();

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));
vi.mock("../services/api", () => ({
    authApi: () => ({ get: apiGet, patch: apiPatch }),
}));
vi.mock("../utils/userTimezone", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../utils/userTimezone")>();
    return { ...actual, detectBrowserTimezone: () => "Europe/Paris" };
});
vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        fetchAgentSessions: vi.fn(),
        setAgentSessionPin: vi.fn(async () => true),
        deleteAgentSession: vi.fn(),
        deleteAllAgentSessions: vi.fn(),
        fetchSharedAnswers: vi.fn(),
        withdrawSharedAnswer: vi.fn(),
    };
});

const SESSIONS: AgentSessionSummary[] = [
    {
        session_id: "sess-1",
        created_at: "2026-08-01T09:00:00Z",
        last_active_at: "2026-08-01T10:00:00Z",
        first_query: "what shipped last week?",
        turn_count: 3,
        is_pinned: false,
    },
    {
        session_id: "sess-2",
        created_at: "2026-08-01T08:00:00Z",
        last_active_at: "2026-08-01T08:30:00Z",
        first_query: "summarize the auth thread",
        turn_count: 1,
        is_pinned: false,
    },
];

const ANSWERS: SharedAnswer[] = [
    {
        run_id: "run-1",
        session_id: "sess-1",
        team_id: "team-1",
        question: "who owns billing?",
        answer_snippet: "Billing is owned by the payments squad.",
        started_at: "2026-08-01T10:00:00Z",
        audience_size: 3,
    },
    {
        run_id: "run-2",
        session_id: null,
        team_id: "team-1",
        question: "what is our release cadence?",
        answer_snippet: "Weekly, on Thursdays.",
        started_at: "2026-08-01T09:00:00Z",
        audience_size: 1,
    },
];

const sharedResponse = (over: Partial<Awaited<ReturnType<typeof fetchSharedAnswers>>> = {}) => ({
    share_answers_with_team: true,
    answers: ANSWERS,
    has_more: false,
    ...over,
});

const emitted: AgentSessionsDeletedDetail[] = [];
const onDeleted = (e: Event) =>
    emitted.push((e as CustomEvent<AgentSessionsDeletedDetail>).detail);

beforeEach(() => {
    emitted.length = 0;
    window.addEventListener(AGENT_SESSIONS_DELETED_EVENT, onDeleted);
    vi.mocked(fetchAgentSessions).mockReset().mockResolvedValue(SESSIONS);
    vi.mocked(fetchSharedAnswers).mockReset().mockResolvedValue(sharedResponse());
    vi.mocked(deleteAgentSession).mockReset();
    vi.mocked(deleteAllAgentSessions).mockReset();
    vi.mocked(withdrawSharedAnswer).mockReset();
    apiGet.mockReset().mockImplementation(async (url: string) => {
        if (url.includes("share-answers")) return { data: { share_answers_with_team: true } };
        if (url.includes("timezone")) return { data: { timezone: "Asia/Tokyo" } };
        throw new Error(`unexpected GET ${url}`);
    });
    apiPatch.mockReset();
});

afterEach(() => {
    window.removeEventListener(AGENT_SESSIONS_DELETED_EVENT, onDeleted);
});

const renderPage = (props: Partial<React.ComponentProps<typeof GenosMemoryPage>> = {}) =>
    render(
        <CssVarsProvider>
            <GenosMemoryPage teamId="team-1" {...props} />
        </CssVarsProvider>
    );

const SESSION_1 = "what shipped last week?";
const DELETE_BODY =
    "This permanently deletes the conversation and everything Genos remembers from it. This can't be undone.";

describe("What Genos remembers: the three sections", () => {
    it("renders conversations, shared answers and the settings Genos uses from the API", async () => {
        renderPage();

        expect(screen.getByText("Your Genos conversations")).toBeTruthy();
        expect(screen.getByText("Answers shared with your team")).toBeTruthy();
        expect(screen.getByText("Settings Genos uses")).toBeTruthy();

        // Conversations come from the History list endpoint, for THIS team.
        expect(await screen.findByText(SESSION_1)).toBeTruthy();
        expect(screen.getByText("summarize the auth thread")).toBeTruthy();
        expect(fetchAgentSessions).toHaveBeenCalledWith(
            expect.objectContaining({ accessToken: "tok", teamId: "team-1" })
        );

        // Shared answers: question, snippet, audience. Team-scoped fetch.
        expect(await screen.findByText("who owns billing?")).toBeTruthy();
        expect(screen.getByText("Billing is owned by the payments squad.")).toBeTruthy();
        expect(screen.getByText(/Visible to 3 people, including you/)).toBeTruthy();
        expect(screen.getByText(/Only you can see this/)).toBeTruthy();
        expect(fetchSharedAnswers).toHaveBeenCalledWith({
            accessToken: "tok",
            teamId: "team-1",
        });

        // The switch reflects the server's preference.
        const sw = await screen.findByRole("switch", { name: "Let my answers help teammates" });
        await waitFor(() => expect((sw as HTMLInputElement).checked).toBe(true));

        // Settings: the zone Genos reads (server value, not the browser's
        // "Europe/Paris") and the answer language.
        expect(await screen.findByText("Asia/Tokyo")).toBeTruthy();
        expect(screen.getByText("English")).toBeTruthy();
    });

    it("says in plain words what Genos draws on, without a 'memories' store", async () => {
        renderPage();
        expect(screen.getByText(/doesn't keep a separate store of “memories”/)).toBeTruthy();
        expect(await screen.findByText(/a short summary of turns older than that/)).toBeTruthy();
    });

    it("falls back to the browser's zone when the server value can't be read", async () => {
        apiGet.mockImplementation(async (url: string) => {
            if (url.includes("share-answers")) return { data: { share_answers_with_team: true } };
            throw new Error("down");
        });
        renderPage();
        expect(await screen.findByText("Europe/Paris")).toBeTruthy();
    });

    it("names where the language is changed, and links there only when it can", async () => {
        const { unmount } = renderPage();
        // No navigation callback (the Genos settings dialog can't open the
        // main Settings): the path is spelled out instead of a dead button.
        expect(
            await screen.findByText("You can change it in Settings › General › Language.")
        ).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Change language" })).toBeNull();
        unmount();

        const onOpenLanguageSettings = vi.fn();
        renderPage({ onOpenLanguageSettings });
        await userEvent
            .setup()
            .click(await screen.findByRole("button", { name: "Change language" }));
        expect(onOpenLanguageSettings).toHaveBeenCalledTimes(1);
    });

    it("explains that time zone follows the device and offers no editor for it", async () => {
        renderPage();
        expect(await screen.findByText(/change the time zone on your device/)).toBeTruthy();
    });
});

describe("deleting one conversation", () => {
    const openConfirm = async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText(SESSION_1);
        await user.click(
            screen.getByRole("button", { name: `Delete conversation: ${SESSION_1}` })
        );
        return { user, dialog: await screen.findByRole("alertdialog") };
    };

    it("asks first, with the permanence spelled out, and calls nothing until confirmed", async () => {
        const { user, dialog } = await openConfirm();
        expect(within(dialog).getByText(DELETE_BODY)).toBeTruthy();
        expect(deleteAgentSession).not.toHaveBeenCalled();

        await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(deleteAgentSession).not.toHaveBeenCalled();
        expect(screen.getByText(SESSION_1)).toBeTruthy();
    });

    it("deletes on confirm, drops the row, and announces it", async () => {
        vi.mocked(deleteAgentSession).mockResolvedValue({
            kind: "deleted",
            deletedSessions: 1,
            deletedRuns: 3,
        });
        const { user, dialog } = await openConfirm();
        await user.click(within(dialog).getByRole("button", { name: "Delete conversation" }));

        await waitFor(() => expect(screen.queryByText(SESSION_1)).toBeNull());
        expect(deleteAgentSession).toHaveBeenCalledWith({
            accessToken: "tok",
            sessionId: "sess-1",
        });
        // The other conversation is untouched.
        expect(screen.getByText("summarize the auth thread")).toBeTruthy();
        // Everything that could be showing it is told (open conversation,
        // History panel, thread/note Ask).
        expect(emitted).toEqual([{ teamId: "team-1", sessionIds: ["sess-1"] }]);
        // The answer built from it can be gone too, so that list refetches.
        await waitFor(() => expect(fetchSharedAnswers).toHaveBeenCalledTimes(2));
    });

    it("on 409 (still answering) deletes nothing and tells the person to wait", async () => {
        vi.mocked(deleteAgentSession).mockResolvedValue({ kind: "in_flight" });
        const { user, dialog } = await openConfirm();
        await user.click(within(dialog).getByRole("button", { name: "Delete conversation" }));

        expect(
            await within(dialog).findByText(
                "A conversation is still answering. Wait for it to finish, then try again."
            )
        ).toBeTruthy();
        // Dialog stays for a retry; the row stays; nothing was announced.
        expect(screen.getByRole("alertdialog")).toBeTruthy();
        await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(screen.getByText(SESSION_1)).toBeTruthy();
        expect(emitted).toEqual([]);
    });

    it("on 404 (already gone) just removes the row", async () => {
        vi.mocked(deleteAgentSession).mockResolvedValue({ kind: "gone" });
        const { user, dialog } = await openConfirm();
        await user.click(within(dialog).getByRole("button", { name: "Delete conversation" }));

        await waitFor(() => expect(screen.queryByText(SESSION_1)).toBeNull());
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(emitted).toEqual([{ teamId: "team-1", sessionIds: ["sess-1"] }]);
    });

    it("on any other failure keeps the row and says it did not work", async () => {
        vi.mocked(deleteAgentSession).mockResolvedValue({ kind: "error" });
        const { user, dialog } = await openConfirm();
        await user.click(within(dialog).getByRole("button", { name: "Delete conversation" }));

        expect(await within(dialog).findByText("Couldn't delete. Please try again.")).toBeTruthy();
        await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(screen.getByText(SESSION_1)).toBeTruthy();
        expect(emitted).toEqual([]);
    });
});

describe("deleting all conversations", () => {
    const openConfirm = async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText(SESSION_1);
        await user.click(screen.getByRole("button", { name: "Delete all conversations" }));
        return { user, dialog: await screen.findByRole("alertdialog") };
    };

    it("needs an explicit acknowledgement and names what it reaches", async () => {
        const { user, dialog } = await openConfirm();
        // Stronger than the single delete: it also says what the list hides
        // and that other teams are untouched.
        expect(within(dialog).getByText(/older ones this list doesn't show/)).toBeTruthy();
        expect(within(dialog).getByText(/other teams are not affected/)).toBeTruthy();

        const confirm = within(dialog).getByRole("button", { name: "Delete everything" });
        expect((confirm as HTMLButtonElement).disabled).toBe(true);
        await user.click(
            within(dialog).getByRole("checkbox", { name: "I understand this can't be undone" })
        );
        expect((confirm as HTMLButtonElement).disabled).toBe(false);
        expect(deleteAllAgentSessions).not.toHaveBeenCalled();
    });

    it("deletes this team's conversations, empties the list and announces it", async () => {
        vi.mocked(deleteAllAgentSessions).mockResolvedValue({
            kind: "deleted",
            deletedSessions: 2,
            deletedRuns: 4,
        });
        const { user, dialog } = await openConfirm();
        await user.click(
            within(dialog).getByRole("checkbox", { name: "I understand this can't be undone" })
        );
        await user.click(within(dialog).getByRole("button", { name: "Delete everything" }));

        await waitFor(() =>
            expect(screen.getByText("You have no Genos conversations in this team.")).toBeTruthy()
        );
        expect(deleteAllAgentSessions).toHaveBeenCalledWith({
            accessToken: "tok",
            teamId: "team-1",
        });
        expect(
            screen.getByText("All your Genos conversations in this team were deleted.")
        ).toBeTruthy();
        expect(emitted).toEqual([{ teamId: "team-1", all: true }]);
        await waitFor(() => expect(fetchSharedAnswers).toHaveBeenCalledTimes(2));
    });

    it("on 409 keeps every conversation and tells the person to wait", async () => {
        vi.mocked(deleteAllAgentSessions).mockResolvedValue({ kind: "in_flight" });
        const { user, dialog } = await openConfirm();
        await user.click(
            within(dialog).getByRole("checkbox", { name: "I understand this can't be undone" })
        );
        await user.click(within(dialog).getByRole("button", { name: "Delete everything" }));

        expect(await within(dialog).findByText(/Wait for it to finish/)).toBeTruthy();
        expect(screen.getByText(SESSION_1)).toBeTruthy();
        expect(screen.getByText("summarize the auth thread")).toBeTruthy();
        expect(emitted).toEqual([]);
    });

    it("is offered even when the list is empty, since it also removes what the list hides", async () => {
        vi.mocked(fetchAgentSessions).mockResolvedValue([]);
        renderPage();
        expect(
            await screen.findByText("You have no Genos conversations in this team.")
        ).toBeTruthy();
        const button = screen.getByRole("button", { name: "Delete all conversations" });
        expect((button as HTMLButtonElement).disabled).toBe(false);
    });
});

describe("the sharing switch", () => {
    const sharingSwitch = async () =>
        (await screen.findByRole("switch", {
            name: "Let my answers help teammates",
        })) as HTMLInputElement;

    it("asks before turning off, and does nothing if cancelled", async () => {
        const user = userEvent.setup();
        renderPage();
        const sw = await sharingSwitch();
        await waitFor(() => expect(sw.checked).toBe(true));

        await user.click(sw);
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText(/removed from your teams right away/)).toBeTruthy();
        // Turning it back on re-shares the recent answers shortly afterward
        // (the server re-collects them in the background), and an answer the
        // person stopped sharing one by one stays stopped. The copy must not
        // promise answers older than the recent ones, so it says "recent",
        // and the old line about older answers not coming back must be gone.
        expect(
            within(dialog).getByText(/your recent answers are shared again shortly afterward/)
        ).toBeTruthy();
        expect(
            within(dialog).getByText(/Answers you stopped sharing one by one stay stopped/)
        ).toBeTruthy();
        expect(within(dialog).queryByText(/older ones may not come back/)).toBeNull();
        expect(apiPatch).not.toHaveBeenCalled();
        // The switch has not moved ahead of the server.
        expect(sw.checked).toBe(true);

        await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(apiPatch).not.toHaveBeenCalled();
        expect(sw.checked).toBe(true);
        expect(screen.getByText("who owns billing?")).toBeTruthy();
    });

    it("PATCHes false on confirm and clears the list of shared answers", async () => {
        apiPatch.mockResolvedValue({ data: { share_answers_with_team: false } });
        const user = userEvent.setup();
        renderPage();
        const sw = await sharingSwitch();
        await waitFor(() => expect(sw.checked).toBe(true));
        await screen.findByText("who owns billing?");

        await user.click(sw);
        const dialog = await screen.findByRole("alertdialog");
        await user.click(within(dialog).getByRole("button", { name: "Turn off sharing" }));

        await waitFor(() => expect(screen.queryByText("who owns billing?")).toBeNull());
        expect(apiPatch).toHaveBeenCalledWith(
            "/user/preferences/share-answers/",
            { share_answers_with_team: false },
            expect.anything()
        );
        expect(
            screen.getByText("Sharing is off, so none of your answers are shared.")
        ).toBeTruthy();
        expect(sw.checked).toBe(false);
    });

    it("keeps the switch on and the list intact when the PATCH fails", async () => {
        apiPatch.mockRejectedValue(new Error("500"));
        const user = userEvent.setup();
        renderPage();
        const sw = await sharingSwitch();
        await waitFor(() => expect(sw.checked).toBe(true));
        await screen.findByText("who owns billing?");

        await user.click(sw);
        const dialog = await screen.findByRole("alertdialog");
        await user.click(within(dialog).getByRole("button", { name: "Turn off sharing" }));

        expect(
            await within(dialog).findByText("Couldn't change this setting. Please try again.")
        ).toBeTruthy();
        expect(sw.checked).toBe(true);
        expect(screen.getByText("who owns billing?")).toBeTruthy();
    });

    it("turning it back on needs no confirm: PATCHes true and refetches the list", async () => {
        apiGet.mockImplementation(async (url: string) => {
            if (url.includes("share-answers")) return { data: { share_answers_with_team: false } };
            return { data: { timezone: "Asia/Tokyo" } };
        });
        vi.mocked(fetchSharedAnswers).mockResolvedValue(
            sharedResponse({ share_answers_with_team: false, answers: [] })
        );
        apiPatch.mockResolvedValue({ data: { share_answers_with_team: true } });
        const user = userEvent.setup();
        renderPage();
        const sw = await sharingSwitch();
        await waitFor(() => expect(sw.checked).toBe(false));
        expect(
            await screen.findByText("Sharing is off, so none of your answers are shared.")
        ).toBeTruthy();

        vi.mocked(fetchSharedAnswers).mockResolvedValue(sharedResponse());
        await user.click(sw);

        await waitFor(() => expect(sw.checked).toBe(true));
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(apiPatch).toHaveBeenCalledWith(
            "/user/preferences/share-answers/",
            { share_answers_with_team: true },
            expect.anything()
        );
        expect(await screen.findByText("who owns billing?")).toBeTruthy();
    });

    it("is disabled rather than guessed when the preference can't be read at all", async () => {
        apiGet.mockImplementation(async (url: string) => {
            if (url.includes("share-answers")) throw new Error("down");
            return { data: { timezone: "Asia/Tokyo" } };
        });
        vi.mocked(fetchSharedAnswers).mockResolvedValue(null);
        renderPage();
        const sw = await sharingSwitch();
        await waitFor(() => expect(sw.disabled).toBe(true));
    });
});

describe("stopping to share one answer", () => {
    const openConfirm = async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText("who owns billing?");
        await user.click(screen.getAllByRole("button", { name: "Stop sharing this answer" })[0]);
        return { user, dialog: await screen.findByRole("alertdialog") };
    };

    it("says what stays and what is final, then withdraws only that answer", async () => {
        vi.mocked(withdrawSharedAnswer).mockResolvedValue({ kind: "withdrawn" });
        const { user, dialog } = await openConfirm();
        expect(
            within(dialog).getByText(
                "Teammates will no longer see it as a “Previous answer”. The conversation stays in your history, and this answer won't be shared again."
            )
        ).toBeTruthy();
        expect(withdrawSharedAnswer).not.toHaveBeenCalled();

        await user.click(within(dialog).getByRole("button", { name: "Stop sharing" }));

        await waitFor(() => expect(screen.queryByText("who owns billing?")).toBeNull());
        expect(withdrawSharedAnswer).toHaveBeenCalledWith({ accessToken: "tok", runId: "run-1" });
        // The other answer, and every conversation, are untouched.
        expect(screen.getByText("what is our release cadence?")).toBeTruthy();
        expect(screen.getByText(SESSION_1)).toBeTruthy();
        expect(deleteAgentSession).not.toHaveBeenCalled();
    });

    it("treats 404 as already withdrawn", async () => {
        vi.mocked(withdrawSharedAnswer).mockResolvedValue({ kind: "gone" });
        const { user, dialog } = await openConfirm();
        await user.click(within(dialog).getByRole("button", { name: "Stop sharing" }));
        await waitFor(() => expect(screen.queryByText("who owns billing?")).toBeNull());
    });

    it("keeps the answer listed when the request fails", async () => {
        vi.mocked(withdrawSharedAnswer).mockResolvedValue({ kind: "error" });
        const { user, dialog } = await openConfirm();
        await user.click(within(dialog).getByRole("button", { name: "Stop sharing" }));
        expect(
            await within(dialog).findByText("Couldn't stop sharing that answer. Please try again.")
        ).toBeTruthy();
        await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(screen.getByText("who owns billing?")).toBeTruthy();
    });
});

describe("the shared answers list states", () => {
    it("says the list was cut short when the server says there are more", async () => {
        vi.mocked(fetchSharedAnswers).mockResolvedValue(sharedResponse({ has_more: true }));
        renderPage();
        expect(
            await screen.findByText(
                "Showing your latest 2 shared answers. There are more than this list shows."
            )
        ).toBeTruthy();
    });

    it("does not say 'nothing is shared' when the request failed", async () => {
        vi.mocked(fetchSharedAnswers).mockResolvedValueOnce(null);
        const user = userEvent.setup();
        renderPage();
        expect(await screen.findByText("Couldn't load your shared answers.")).toBeTruthy();
        expect(
            screen.queryByText("None of your answers are shared with teammates right now.")
        ).toBeNull();

        await user.click(screen.getByRole("button", { name: "Retry" }));
        expect(await screen.findByText("who owns billing?")).toBeTruthy();
    });

    it("says so when nothing is shared", async () => {
        vi.mocked(fetchSharedAnswers).mockResolvedValue(sharedResponse({ answers: [] }));
        renderPage();
        expect(
            await screen.findByText("None of your answers are shared with teammates right now.")
        ).toBeTruthy();
    });
});
