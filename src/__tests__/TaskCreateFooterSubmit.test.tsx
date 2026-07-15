/**
 * Pins the caller half of the "create failed silently" bug.
 *
 * `UploadNewTaskFailure.test.ts` proves `uploadNewTask` REPORTS a failure.
 * This proves the footer HONORS it — which is what the user actually felt.
 * `setIsSubmitted(true)` closes the form and wipes the persisted draft, and
 * it used to run on every outcome because `uploadNewTask` swallowed its own
 * throw. A refactor that goes back to ignoring the result would leave every
 * other test in the suite green, so the guard needs its own test.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskCreateFooter } from "../features/tasks/components/contents/base/TaskCreateFooter";
import { uploadNewTask, type UploadNewTaskResult } from "../features/tasks/services/uploadNewTask";

vi.mock("../features/tasks/services/uploadNewTask", () => ({
    uploadNewTask: vi.fn(),
}));

const uploadNewTaskMock = vi.mocked(uploadNewTask);

const myself = { userId: "u1", userName: "Me", teamId: "t1" } as any;

const taskContent = {
    id: 101,
    title: "New task",
    project: { projectId: 7, projectName: "Proj", systemUserId: "sys-1" },
    attachments: [],
} as any;

const renderFooter = () => {
    const setIsSubmitted = vi.fn();
    const setTitleError = vi.fn();
    const setTitleErrorOpen = vi.fn();
    const useTM = {
        setCurrentPreviewTaskId: vi.fn(),
        setIsTaskTableVisible: vi.fn(),
        setIsTaskPreviewVisible: vi.fn(),
        setTaskDraft: vi.fn(),
        setIsCreatingTask: vi.fn(),
        setInitialEmptyTaskId: vi.fn(),
        currentPreviewTask: null,
    } as any;
    const usePM = { setCurrentProject: vi.fn() } as any;

    const utils = render(
        <CssVarsProvider>
            <TaskCreateFooter
                accessToken="token"
                myself={myself}
                setIsSubmitted={setIsSubmitted}
                setTitleError={setTitleError}
                setTitleErrorOpen={setTitleErrorOpen}
                socket={null}
                taskContent={taskContent}
                taskTitle="New task"
                useCM={{} as any}
                usePM={usePM}
                useTM={useTM}
            />
        </CssVarsProvider>
    );

    return { ...utils, setIsSubmitted, setTitleError, setTitleErrorOpen, useTM, usePM };
};

const clickCreate = (getByText: ReturnType<typeof renderFooter>["getByText"]) =>
    fireEvent.click(getByText("Create Task"));

describe("TaskCreateFooter submit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // `lastProjectId` is asserted in both directions below, so it can't
        // carry over between tests.
        localStorage.clear();
    });

    it("does NOT tear the form down when the create fails", async () => {
        uploadNewTaskMock.mockResolvedValue({ ok: false } as UploadNewTaskResult);
        const { getByText, setIsSubmitted, useTM, usePM } = renderFooter();

        clickCreate(getByText);

        await waitFor(() => expect(uploadNewTaskMock).toHaveBeenCalled());
        // The bug: this closed the form AND wiped the draft, so the user
        // lost their input and never learned why.
        expect(setIsSubmitted).not.toHaveBeenCalled();
        // Nor should a failed create swap the view out from under the form
        // that's still open, or move the project the user is working in.
        expect(useTM.setIsTaskPreviewVisible).not.toHaveBeenCalled();
        expect(useTM.setIsTaskTableVisible).not.toHaveBeenCalled();
        expect(usePM.setCurrentProject).not.toHaveBeenCalled();
        expect(localStorage.getItem("lastProjectId")).toBeNull();
    });

    it("tears the form down when the create succeeds", async () => {
        uploadNewTaskMock.mockResolvedValue({ ok: true, taskId: 101 } as UploadNewTaskResult);
        const { getByText, setIsSubmitted, usePM } = renderFooter();

        clickCreate(getByText);

        // The guard on the guard: a footer that never submits would pass the
        // failure test above while breaking task creation outright.
        await waitFor(() => expect(setIsSubmitted).toHaveBeenCalledWith(true));
        expect(usePM.setCurrentProject).toHaveBeenCalledWith(taskContent.project);
        expect(localStorage.getItem("lastProjectId")).toBe("7");
    });

    it("re-enables the Create button after a failure so the user can retry", async () => {
        uploadNewTaskMock.mockResolvedValue({ ok: false } as UploadNewTaskResult);
        const { getByText } = renderFooter();

        clickCreate(getByText);

        // Retry IS the Create button — if the in-flight lock leaked, the
        // form would be visibly stuck at "Creating…" with no way forward.
        await waitFor(() => expect(uploadNewTaskMock).toHaveBeenCalled());
        await waitFor(() => expect(getByText("Create Task").closest("button")).not.toBeDisabled());
    });
});
