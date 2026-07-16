/**
 * Delete-confirm dialog for task comments.
 *
 * The dialog owns the socket DELETE emit (mirroring how
 * `ModalDeleteMessage` owns the chat-message delete), so these tests
 * pin the contract the bubble relies on:
 *   - confirm emits `task_comment` with the DELETE payload and closes;
 *     the emit ack drops the comment cache via `emitTaskTouched`;
 *   - cancel closes without emitting (no accidental deletes);
 *   - a missing socket surfaces the error alert instead of silently
 *     closing (the pre-modal flow just returned, hiding the failure);
 *   - clicks inside the dialog do NOT bubble to the hosting bubble.
 *     The dialog portals to <body>, but React synthetic events bubble
 *     through the COMPONENT tree — without the fence, every click in
 *     the dialog would fire the bubble's `onCommentClick` deep-link
 *     navigation underneath.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { Socket } from "socket.io-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalDeleteTaskComment } from "../features/tasks/components/modals/ModalDeleteTaskComment";
import type { TaskCommentProps } from "../types/tasks";

const emitTaskTouched = vi.hoisted(() => vi.fn());
vi.mock("../features/tasks/services/taskEvents", () => ({
    emitTaskTouched,
}));

const comment = {
    commentId: 7,
    commentBody: [],
    senderId: "u1",
    senderName: "User One",
    taskId: 42,
    tsSent: "2026-07-16 00:00:00",
    tsUpdated: "2026-07-16 00:00:00",
} as unknown as TaskCommentProps;

const renderModal = ({
    socket,
    setOpen = vi.fn(),
    onOutsideClick = vi.fn(),
}: {
    socket: Socket | null;
    setOpen?: (value: boolean) => void;
    onOutsideClick?: () => void;
}) => {
    render(
        <CssVarsProvider>
            {/* Stand-in for the hosting bubble's click-to-navigate Box. */}
            <div onClick={onOutsideClick}>
                <ModalDeleteTaskComment
                    comment={comment}
                    currentProjectId={3}
                    currentProjectName="Proj"
                    currentTaskDisplayId="PRJ-42"
                    open={true}
                    setOpen={setOpen}
                    socket={socket}
                />
            </div>
        </CssVarsProvider>
    );
    return { setOpen, onOutsideClick };
};

describe("ModalDeleteTaskComment", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("emits the socket DELETE and closes on confirm; the ack invalidates the comment cache", () => {
        const emit = vi.fn();
        const { setOpen } = renderModal({ socket: { emit } as unknown as Socket });

        fireEvent.click(screen.getByRole("button", { name: "Delete Comment" }));

        expect(emit).toHaveBeenCalledTimes(1);
        const [event, payload, ack] = emit.mock.calls[0];
        expect(event).toBe("task_comment");
        expect(payload).toEqual({
            method_type: "DELETE",
            project_id: 3,
            project_name: "Proj",
            task_id: 42,
            display_id: "PRJ-42",
            comment_id: 7,
        });
        expect(setOpen).toHaveBeenCalledWith(false);

        expect(emitTaskTouched).not.toHaveBeenCalled();
        ack();
        expect(emitTaskTouched).toHaveBeenCalledWith(42, "comment");
    });

    it("closes without emitting on cancel", () => {
        const emit = vi.fn();
        const { setOpen } = renderModal({ socket: { emit } as unknown as Socket });

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(emit).not.toHaveBeenCalled();
        expect(setOpen).toHaveBeenCalledWith(false);
    });

    it("shows the error alert instead of closing when the socket is gone", () => {
        const { setOpen } = renderModal({ socket: null });

        fireEvent.click(screen.getByRole("button", { name: "Delete Comment" }));

        expect(screen.getByText("Failed to delete the comment.")).toBeTruthy();
        expect(setOpen).not.toHaveBeenCalled();
    });

    it("does not bubble clicks through the portal into the hosting bubble", () => {
        const { onOutsideClick } = renderModal({ socket: { emit: vi.fn() } as unknown as Socket });

        fireEvent.click(screen.getByText("Delete Comment?"));

        expect(onOutsideClick).not.toHaveBeenCalled();
    });
});
