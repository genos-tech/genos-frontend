/**
 * Focus view of a note: one click hides everything that sits beside the note
 * pane, so the note gets the whole page; the same control puts it all back.
 *
 * Focus is DERIVED from what is on screen, not stored. A stored flag would
 * have to be kept in step with every other path that opens a panel (sidebar
 * Home / Table / Board, a task link inside the note, a chat opening a
 * thread...) and would be wrong the first time one of them was missed.
 *
 * Nothing here discards work in progress: a task being CREATED keeps its
 * panel (hiding it would unmount the form and lose the draft), and a view
 * that is already showing a draft is therefore not "focused".
 */
import type { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import type { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { isNoMainPanelVisible } from "../../../tasks/utils/mainPanelVisibility";

type TaskSide = Pick<
    TaskManagementState,
    | "isTaskTableVisible"
    | "isSprintBoardVisible"
    | "isTaskDashboardVisible"
    | "isTaskPreviewVisible"
    | "isCreatingTask"
>;

/** Task page: the note pane is alone beside the sidebar. */
export const isTaskNoteFocused = (useTM: TaskSide, isNotePaneOnScreen: boolean): boolean =>
    isNotePaneOnScreen === true &&
    isNoMainPanelVisible(useTM) &&
    useTM.isTaskPreviewVisible === false &&
    useTM.isCreatingTask.flag === false;

export const enterTaskNoteFocus = (
    useTM: Pick<
        TaskManagementState,
        | "setIsTaskTableVisible"
        | "setIsSprintBoardVisible"
        | "setIsTaskDashboardVisible"
        | "closeTaskPreview"
    >
) => {
    // The three main panels are mutually exclusive, so each flag is cleared
    // explicitly rather than assuming which one is up.
    useTM.setIsTaskTableVisible(false);
    useTM.setIsSprintBoardVisible(false);
    useTM.setIsTaskDashboardVisible(false);
    useTM.closeTaskPreview();
};

export const exitTaskNoteFocus = (useTM: Pick<TaskManagementState, "setIsTaskTableVisible">) => {
    useTM.setIsTaskTableVisible(true);
};

type ChatSide = Pick<ChatManagementState, "isMainChatVisible" | "isThreadVisible">;

/** Chat page: the note pane is alone (no chat, thread, task preview or create form). */
export const isChatNoteFocused = (
    useCM: ChatSide,
    useTM: Pick<TaskManagementState, "isTaskPreviewVisible" | "isCreatingTask">,
    isNotePaneOnScreen: boolean
): boolean =>
    isNotePaneOnScreen === true &&
    useCM.isMainChatVisible === false &&
    useCM.isThreadVisible === false &&
    useTM.isTaskPreviewVisible === false &&
    useTM.isCreatingTask.flag === false;

export const enterChatNoteFocus = (
    useCM: Pick<ChatManagementState, "setIsMainChatVisible" | "setIsThreadVisible">,
    useTM: Pick<TaskManagementState, "closeTaskPreview">
) => {
    useCM.setIsMainChatVisible(false);
    useCM.setIsThreadVisible(false);
    useTM.closeTaskPreview();
};

export const exitChatNoteFocus = (useCM: Pick<ChatManagementState, "setIsMainChatVisible">) => {
    useCM.setIsMainChatVisible(true);
};
