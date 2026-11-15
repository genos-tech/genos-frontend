/**
 * The window "Ask Genos about this task / milestone" opens (MIP-1057): the real `TaskAskHost`, modal and
 * ask machine, with the transport mocked. It reads the way a member would meet it: the subject in the
 * header, the conversation restored on open, "New conversation" really starting another one (and
 * handing the keyboard back), a task that cannot be opened said calmly with one way on, and the Cmd-K
 * conversation never in the picture.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskAskHost } from "../features/taskAsk";
import { requestAskGenosAboutTask, type TaskAskRequest } from "../features/taskAsk/taskAskLink";
import { en } from "../i18n/locales/en";
import { askAgentStream, fetchTaskSession, type TaskSessionResult } from "../services/agentApi";

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        askAgentStream: vi.fn(),
        decideAgent: vi.fn(),
        fetchTaskSession: vi.fn(),
        submitAgentFeedback: vi.fn(async () => true),
    };
});
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
}));

const t = en.taskAsk;
const REQUEST: TaskAskRequest = {
    taskId: 2039,
    projectId: 7,
    displayId: "MIP-1057",
    title: "Per-object Ask sessions",
    isMilestone: false,
};
const MILESTONE: TaskAskRequest = {
    taskId: 555,
    projectId: 7,
    displayId: "MIP-578",
    title: "Genos can do what members can",
    isMilestone: true,
};
const PROJECTS = [
    { projectId: 7, isExternal: undefined, hostTeamId: undefined },
    { projectId: 9, isExternal: true, hostTeamId: "host-7" },
];

const turn = (n: number) => ({
    run_id: `run-${n}`,
    query: `question ${n}`,
    answer: `answer ${n}`,
    status: "done",
    error: null,
    started_at: "2026-11-14T10:00:00Z",
    sources: [],
});
const restored = (id: string | null, n = 2): TaskSessionResult => ({
    kind: "ok",
    agentSessionId: id,
    turns: id ? Array.from({ length: n }, (_, i) => turn(i + 1)) : [],
});

type AskArgs = Parameters<typeof askAgentStream>[0];
const lastAsk = (): AskArgs => {
    const calls = vi.mocked(askAgentStream).mock.calls;
    return calls[calls.length - 1][0];
};

let onAskInGeneral: ReturnType<typeof vi.fn<(draft?: string) => void>>;
let onSelectSource: ReturnType<typeof vi.fn>;
const mount = () => {
    onAskInGeneral = vi.fn<(draft?: string) => void>();
    onSelectSource = vi.fn();
    return render(
        <CssVarsProvider>
            <TaskAskHost
                projects={PROJECTS}
                teamId="team-1"
                onAskInGeneral={onAskInGeneral}
                onSelectSource={onSelectSource}
            />
        </CssVarsProvider>
    );
};
const openFor = async (request: TaskAskRequest = REQUEST) => {
    act(() => requestAskGenosAboutTask(request));
    await screen.findByRole("dialog");
};
const input = () => screen.getByPlaceholderText(/Ask about this/) as HTMLTextAreaElement;
const send = (text: string) => {
    fireEvent.change(input(), { target: { value: text } });
    fireEvent.keyDown(input(), { key: "Enter" });
};

beforeEach(() => {
    vi.mocked(askAgentStream).mockReset();
    vi.mocked(fetchTaskSession).mockReset().mockResolvedValue(restored(null));
});
afterEach(cleanup);

describe("opening it from a menu", () => {
    it("shows the task as the conversation's subject, and says what it is", async () => {
        mount();
        await openFor();
        const dialog = screen.getByRole("dialog");
        expect(within(dialog).getByRole("heading", { name: t.modal.titleTask })).toBeTruthy();
        expect(dialog).toHaveAccessibleName(t.modal.titleTask);
        // The subject is the dialog's description: MIP-1057 · its title.
        expect(dialog).toHaveAccessibleDescription("MIP-1057 · Per-object Ask sessions");
    });

    it("a milestone says milestone, in the title, the hint and the placeholder", async () => {
        mount();
        await openFor(MILESTONE);
        expect(screen.getByRole("dialog")).toHaveAccessibleName(t.modal.titleMilestone);
        expect(screen.getByPlaceholderText(t.conversation.placeholderMilestone)).toBeTruthy();
        await waitFor(() => expect(screen.getByText(t.conversation.emptyMilestone)).toBeTruthy());
    });

    it("restores THIS task's conversation in the team that owns it", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task"));
        mount();
        await openFor();
        await screen.findByText("answer 2");
        expect(screen.getByText("question 1")).toBeTruthy();
        expect(vi.mocked(fetchTaskSession).mock.calls[0][0]).toMatchObject({
            teamId: "team-1",
            taskId: 2039,
        });
    });

    it("a task of a project shared from another team is restored and asked in the HOST team", async () => {
        mount();
        await openFor({ ...REQUEST, projectId: 9 });
        await waitFor(() => expect(fetchTaskSession).toHaveBeenCalledTimes(1));
        expect(vi.mocked(fetchTaskSession).mock.calls[0][0].teamId).toBe("host-7");
        await waitFor(() => expect(input()).toBeTruthy());
        send("is it on track?");
        expect(lastAsk().teamId).toBe("host-7");
        expect(lastAsk().taskContext).toEqual({ taskId: 2039 });
    });

    it("asks with task_context, the restored session and the # mention, and nothing before the person asks", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task"));
        mount();
        await openFor();
        await screen.findByText("answer 2");
        expect(askAgentStream).not.toHaveBeenCalled();
        send("what is left?");
        expect(lastAsk()).toMatchObject({
            query: "what is left?",
            teamId: "team-1",
            sessionId: "sess-task",
            taskContext: { taskId: 2039 },
            mentions: [{ type: "task", task_id: 2039, label: "MIP-1057" }],
        });
    });

    it("waits for the restore: typing is allowed, sending is not", async () => {
        vi.mocked(fetchTaskSession).mockImplementation(() => new Promise(() => {}));
        mount();
        await openFor();
        expect(screen.getByText(t.loading)).toBeTruthy();
        fireEvent.change(input(), { target: { value: "too early" } });
        fireEvent.keyDown(input(), { key: "Enter" });
        expect(askAgentStream).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: en.common.actions.send })).toBeDisabled();
    });

    it("closing keeps the conversation: reopening the same task does not ask the server again", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task"));
        mount();
        await openFor();
        await screen.findByText("answer 2");
        fireEvent.click(screen.getByRole("button", { name: en.common.actions.close }));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        await openFor();
        expect(screen.getByText("answer 2")).toBeTruthy();
        expect(fetchTaskSession).toHaveBeenCalledTimes(1);
    });
});

describe("a source cited in the conversation", () => {
    // A task has a deep link, but with no link-preview modal around (this window is mounted above it
    // in the tests, as an app with no preview open) the app navigates: the window must not stay
    // open over the page it navigated to.
    it("with no preview to open, closes the window and hands the source to the app to navigate to", async () => {
        const source = {
            entity_type: "task",
            entity_id: "task:42",
            title: "framer-motion spike",
            task_id: "42",
            project_id: "7",
        };
        vi.mocked(fetchTaskSession).mockResolvedValue({
            kind: "ok",
            agentSessionId: "sess-task",
            turns: [
                {
                    ...turn(1),
                    answer: "See [the link](task:42) and [task:42].",
                    sources: [source],
                },
            ] as never,
        });
        mount();
        await openFor();
        fireEvent.click(await screen.findByRole("button", { name: /framer-motion spike/ }));
        expect(onSelectSource).toHaveBeenCalledWith(
            expect.objectContaining({ entity_id: "task:42" })
        );
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
});

describe("New conversation", () => {
    it("is a visible button, described for a screen reader, disabled while there is nothing to clear", async () => {
        mount();
        await openFor();
        const button = await screen.findByRole("button", { name: t.conversation.newConversation });
        expect(button).toBeDisabled();
        expect(button).toHaveAccessibleDescription(t.conversation.newConversationHint);
    });

    it("starts another conversation: the old turns go, the next ask is new_conversation with no session, and the input has the keyboard", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-old"));
        mount();
        await openFor();
        await screen.findByText("answer 2");
        const button = screen.getByRole("button", { name: t.conversation.newConversation });
        expect(button).toBeEnabled();

        fireEvent.click(button);
        expect(screen.queryByText("answer 2")).toBeNull();
        // Said in a polite live region, not shown.
        const said = screen.getByText(t.conversation.newConversationStarted);
        expect(said.closest('[aria-live="polite"]')).not.toBeNull();
        await waitFor(() => expect(document.activeElement).toBe(input()));

        send("a fresh start");
        expect(lastAsk().newConversation).toBe(true);
        expect(lastAsk().sessionId).toBeUndefined();
        expect(lastAsk().taskContext).toEqual({ taskId: 2039 });
        // The spoken sentence is for the moment it happens.
        expect(screen.queryByText(t.conversation.newConversationStarted)).toBeNull();
    });
});

describe("a task that cannot be opened any more", () => {
    it("restore 404: said calmly, once, with one way on; no input, no New conversation", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue({ kind: "gone" });
        mount();
        await openFor();
        await screen.findByText(t.gone.titleTask);
        expect(screen.getByText(t.gone.body)).toBeTruthy();
        expect(screen.queryByPlaceholderText(/Ask about this/)).toBeNull();
        expect(screen.queryByRole("textbox")).toBeNull();
        expect(screen.queryByRole("button", { name: t.conversation.newConversation })).toBeNull();
        // Nothing was asked, and nothing is retried.
        await new Promise((r) => setTimeout(r, 50));
        expect(askAgentStream).not.toHaveBeenCalled();
        expect(fetchTaskSession).toHaveBeenCalledTimes(1);
    });

    it("a milestone says milestone", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue({ kind: "gone" });
        mount();
        await openFor(MILESTONE);
        await screen.findByText(t.gone.titleMilestone);
    });

    it("the notice is in a live region that was already there, so it is announced", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue({ kind: "gone" });
        mount();
        await openFor();
        const notice = await screen.findByText(t.gone.titleTask);
        expect(notice.closest('[role="status"]')).not.toBeNull();
    });

    it("'Ask Genos in general' closes the window and hands over to the general ask", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue({ kind: "gone" });
        mount();
        await openFor();
        fireEvent.click(await screen.findByRole("button", { name: t.gone.askInGeneral }));
        expect(onAskInGeneral).toHaveBeenCalledTimes(1);
        expect(onAskInGeneral.mock.calls[0][0]).toBeUndefined();
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("deleted while the window was open: the refused question stays, the window says why, the input is gone, and nothing is sent twice", async () => {
        mount();
        await openFor();
        await waitFor(() => expect(input()).toBeTruthy());
        send("still there?");
        act(() => {
            lastAsk().onTaskNotFound?.();
            lastAsk().onError(en.services.agent.taskNotFound);
        });
        await screen.findByText(t.gone.titleTask);
        expect(screen.getByText("still there?")).toBeTruthy();
        expect(screen.getByText(en.services.agent.taskNotFound)).toBeTruthy();
        expect(screen.queryByRole("textbox")).toBeNull();
        expect(askAgentStream).toHaveBeenCalledTimes(1);
        expect(fetchTaskSession).toHaveBeenCalledTimes(1);
    });

    it("'Ask again' on the refused question goes to the general ask with that question as its draft", async () => {
        mount();
        await openFor();
        await waitFor(() => expect(input()).toBeTruthy());
        send("is it late?");
        act(() => {
            lastAsk().onTaskNotFound?.();
            lastAsk().onError(en.services.agent.taskNotFound);
        });
        await screen.findByText(t.gone.titleTask);
        fireEvent.click(screen.getByRole("button", { name: en.spotlight.actions.retry }));
        expect(onAskInGeneral).toHaveBeenCalledWith("is it late?");
        expect(askAgentStream).toHaveBeenCalledTimes(1);
    });
});

describe("a restore that could not load", () => {
    it("says so in our words (never the server's status line), offers Retry, and still lets the person ask", async () => {
        vi.mocked(fetchTaskSession)
            .mockResolvedValueOnce({ kind: "failed", message: "Server returned 502" })
            .mockResolvedValue(restored("sess-task"));
        mount();
        await openFor();
        await screen.findByText(en.services.agent.taskSessionLoadFailed);
        expect(screen.queryByText("Server returned 502")).toBeNull();
        expect(input()).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: en.common.actions.retry }));
        await screen.findByText("answer 2");
        expect(screen.queryByText(en.services.agent.taskSessionLoadFailed)).toBeNull();
        expect(fetchTaskSession).toHaveBeenCalledTimes(2);
    });
});
