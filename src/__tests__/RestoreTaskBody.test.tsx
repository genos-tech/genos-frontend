/**
 * Restoring the description an agent, API key or MCP replaced (MIP-738).
 *
 * The server keeps the replaced body on the history row; this is the button that
 * puts it back. What matters: it appears ONLY on a row that kept a body and
 * only when the feed knows its task (never offered against a guessed one);
 * nothing is changed until the person confirms; and every outcome (done, gone,
 * failed) is said on screen, not swallowed.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskActivityFeed } from "../features/tasks/components/contents/base/sub/TaskActivityFeed";
import { restoreTaskBody } from "../features/tasks/services/restoreTaskBody";
import { onTaskTouched } from "../features/tasks/services/taskEvents";
import { authApi } from "../services/api";
import { keepsPreviousBody, type TaskActivityProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../services/api", () => ({ authApi: vi.fn() }));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <span />,
}));

const post = vi.fn();
const httpError = (status: number) => {
    const err = new AxiosError("fail");
    err.response = { status, data: {} } as never;
    return err;
};

const row = (over: Partial<TaskActivityProps> = {}): TaskActivityProps => ({
    activityId: 7,
    actionType: "description_edited",
    fieldName: "content",
    oldValue: null,
    newValue: null,
    metadata: { previousBodyKept: true, via: { kind: "agent" } },
    actor: { userId: "u1", userName: "Ken", avatarImgPath: null },
    tsCreatedAt: new Date().toISOString(),
    ...over,
});

const NO_TASK = Symbol("no task id");
const renderFeed = (
    activities: TaskActivityProps[],
    taskId: number | null | undefined | typeof NO_TASK = 42
) =>
    render(
        <CssVarsProvider>
            <TaskActivityFeed
                activities={activities}
                allTasks={[]}
                isLoading={false}
                myself={{ userId: "u1" } as never}
                setMyself={() => {}}
                socket={null}
                taskId={taskId === NO_TASK ? undefined : taskId}
                useCM={{} as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );

const BUTTON = /Restore the previous description/i;

beforeEach(() => {
    vi.clearAllMocks();
    post.mockReset();
    vi.mocked(authApi).mockReturnValue({ post } as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("keepsPreviousBody", () => {
    it("is true only for a description edit that kept its body", () => {
        expect(keepsPreviousBody(row())).toBe(true);
        expect(keepsPreviousBody(row({ metadata: {} }))).toBe(false);
        expect(keepsPreviousBody(row({ metadata: { previousBodyKept: false } }))).toBe(false);
        expect(keepsPreviousBody(row({ metadata: { previousBodyKept: "yes" } }))).toBe(false);
        expect(keepsPreviousBody(row({ actionType: "status_changed" }))).toBe(false);
    });
});

describe("restoreTaskBody", () => {
    it("posts the task and the row, and reports ok", async () => {
        post.mockResolvedValue({ data: {} });

        expect(await restoreTaskBody("tok", 42, 7)).toBe("ok");
        expect(post).toHaveBeenCalledWith(
            "/task/activity/restore-body/",
            { task_id: 42, activity_id: 7 },
            { suppressErrorToast: true }
        );
    });

    it("says not-found for a 404 and for a 400 (a row that kept nothing)", async () => {
        for (const status of [404, 400]) {
            post.mockRejectedValueOnce(httpError(status));
            expect(await restoreTaskBody("tok", 42, 7)).toBe("not-found");
        }
    });

    it("says failed for a server error, the network, and no token; never throws", async () => {
        post.mockRejectedValueOnce(httpError(500));
        expect(await restoreTaskBody("tok", 42, 7)).toBe("failed");
        post.mockRejectedValueOnce(new Error("offline"));
        expect(await restoreTaskBody("tok", 42, 7)).toBe("failed");
        vi.mocked(authApi).mockReturnValueOnce(null as never);
        expect(await restoreTaskBody(null, 42, 7)).toBe("failed");
    });
});

describe("the Restore button in the history", () => {
    it("is offered on a row that kept its body, and says who rewrote it", () => {
        renderFeed([row()]);

        expect(screen.getByRole("button", { name: BUTTON })).toBeInTheDocument();
        expect(screen.getByText(/Rewritten by the Genos AI/)).toBeInTheDocument();
    });

    it("names the API key when it was one", () => {
        renderFeed([
            row({
                metadata: { previousBodyKept: true, via: { kind: "api_key", key_name: "ci-bot" } },
            }),
        ]);

        expect(screen.getByText(/Rewritten through the API \(ci-bot\)/)).toBeInTheDocument();
    });

    it("is not offered on the editor's own autosave row", () => {
        renderFeed([row({ metadata: { via: { kind: "app" } } })]);

        expect(screen.queryByRole("button", { name: BUTTON })).not.toBeInTheDocument();
    });

    it("is not offered when the feed does not know its task", () => {
        for (const taskId of [null, NO_TASK]) {
            const { unmount } = renderFeed([row()], taskId);
            expect(screen.queryByRole("button", { name: BUTTON })).not.toBeInTheDocument();
            unmount();
        }
    });

    it("is offered on each row that kept a body, so a restore can be undone", () => {
        renderFeed([row({ activityId: 9 }), row({ activityId: 8 }), row({ activityId: 7 })]);

        expect(screen.getAllByRole("button", { name: BUTTON })).toHaveLength(3);
    });

    it("changes nothing until the person confirms", async () => {
        renderFeed([row()]);

        await userEvent.click(screen.getByRole("button", { name: BUTTON }));

        expect(
            await screen.findByText(/replaces the description as it is now/i)
        ).toBeInTheDocument();
        expect(post).not.toHaveBeenCalled();
    });

    it("says a restore can be undone", async () => {
        renderFeed([row()]);

        await userEvent.click(screen.getByRole("button", { name: BUTTON }));

        expect(await screen.findByText(/You can undo it/i)).toBeInTheDocument();
    });

    it("cancel closes the dialog and sends nothing", async () => {
        renderFeed([row()]);
        await userEvent.click(screen.getByRole("button", { name: BUTTON }));

        await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

        await waitFor(() =>
            expect(
                screen.queryByText(/replaces the description as it is now/i)
            ).not.toBeInTheDocument()
        );
        expect(post).not.toHaveBeenCalled();
    });

    it("restores the row it belongs to, then refreshes the history for that task", async () => {
        post.mockResolvedValue({ data: {} });
        const touched = vi.fn();
        const off = onTaskTouched(touched);
        renderFeed([row({ activityId: 7 })], 42);

        await userEvent.click(screen.getByRole("button", { name: BUTTON }));
        await userEvent.click(await screen.findByRole("button", { name: "Restore" }));

        await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
        expect(post.mock.calls[0][1]).toEqual({ task_id: 42, activity_id: 7 });
        await waitFor(() => expect(touched).toHaveBeenCalledWith({ taskId: 42, kind: "update" }));
        await waitFor(() =>
            expect(
                screen.queryByText(/replaces the description as it is now/i)
            ).not.toBeInTheDocument()
        );
        off();
    });

    it("acts on the row whose button was pressed, not another", async () => {
        post.mockResolvedValue({ data: {} });
        renderFeed([row({ activityId: 9 }), row({ activityId: 8 })]);

        await userEvent.click(screen.getAllByRole("button", { name: BUTTON })[1]);
        await userEvent.click(await screen.findByRole("button", { name: "Restore" }));

        await waitFor(() => expect(post).toHaveBeenCalled());
        expect(post.mock.calls[0][1].activity_id).toBe(8);
    });

    it("keeps the dialog open and says so when the version is gone", async () => {
        post.mockRejectedValue(httpError(404));
        const touched = vi.fn();
        const off = onTaskTouched(touched);
        renderFeed([row()]);

        await userEvent.click(screen.getByRole("button", { name: BUTTON }));
        await userEvent.click(await screen.findByRole("button", { name: "Restore" }));

        expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
        expect(touched).not.toHaveBeenCalled();
        off();
    });

    it("keeps the dialog open and says so when the restore fails, and can be retried", async () => {
        post.mockRejectedValueOnce(httpError(500)).mockResolvedValueOnce({ data: {} });
        renderFeed([row()]);

        await userEvent.click(screen.getByRole("button", { name: BUTTON }));
        await userEvent.click(await screen.findByRole("button", { name: "Restore" }));
        expect(await screen.findByText(/Couldn't restore the description/i)).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Restore" }));
        await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
        await waitFor(() =>
            expect(screen.queryByText(/Couldn't restore the description/i)).not.toBeInTheDocument()
        );
    });

    it("cannot be sent twice while a restore is in flight", async () => {
        let resolve!: (v: unknown) => void;
        post.mockReturnValue(new Promise((r) => (resolve = r)));
        renderFeed([row()]);

        await userEvent.click(screen.getByRole("button", { name: BUTTON }));
        await userEvent.click(await screen.findByRole("button", { name: "Restore" }));

        // Mid-flight the confirm button is genuinely `disabled` (Joy's loading
        // state), so neither a click nor Enter can submit it again, and Cancel is
        // disabled too so the dialog cannot be dismissed over a pending write.
        // (`if (busy) return` in `confirm` is a second line of defence that this
        // UI cannot reach, so no test pins it.)
        await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
        expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
        const button = screen.getByRole("button", { name: /Restore$/ });
        expect(button).toBeDisabled();
        button.focus();
        await userEvent.keyboard("{Enter}");
        fireEvent.click(button);
        expect(post).toHaveBeenCalledTimes(1);

        resolve({ data: {} });
        await waitFor(() =>
            expect(
                screen.queryByText(/replaces the description as it is now/i)
            ).not.toBeInTheDocument()
        );
    });
});
