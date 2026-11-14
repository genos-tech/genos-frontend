// Per-tool structured previews for the write-tool ApprovalCard.
//
// The backend's `tool_call_pending_approval` event already carries the
// model's proposed arguments (friendly-ized server-side: raw ids →
// project names / usernames / display_ids, and `update_tasks_bulk`
// rows enriched with a `current` field snapshot). For small tools the
// card's key:value fallback is fine; for composite tools
// (`create_task_plan`'s milestone + task tree, `update_tasks_bulk`'s
// batch diff) it's unreadable — these renderers turn the same args
// into a reviewable layout.
//
// Adding a preview for a new tool = add a component + one entry here.
// Tools without an entry keep the fallback, so this file can never
// regress an existing approval flow.

import type { FC } from "react";

import { AddCommentPreview } from "./AddCommentPreview";
import { BulkUpdatePreview } from "./BulkUpdatePreview";
import { hasCalendarCardFacts } from "./calendarCardFacts";
import {
    CreateCalendarEventPreview,
    DeleteCalendarEventPreview,
    UpdateCalendarEventPreview,
} from "./CalendarEventPreview";
import { DeleteCommentPreview, UpdateCommentPreview } from "./CommentWritePreview";
import { CreateTaskPreview } from "./CreateTaskPreview";
import { ApproveJoinRequestPreview, DeclineJoinRequestPreview } from "./JoinRequestPreview";
import { DeleteMilestonePreview, ManageMilestonePreview } from "./MilestoneWritePreview";
import {
    DeleteNoteFolderPreview,
    DeleteNotePreview,
    ManageNoteSharingPreview,
} from "./NoteDeleteSharePreview";
import { FavoriteNotePreview, ManageNoteFolderPreview } from "./NoteFolderWritePreview";
import { NoteWritePreview } from "./NoteWritePreview";
import { AddProjectTagPreview, ManageProjectLabelsPreview } from "./ProjectCatalogPreview";
import { DeleteProjectPreview } from "./ProjectDeletePreview";
import { ManageProjectMembersPreview, ManageProjectPreview } from "./ProjectWritePreview";
import { RestoreTaskBodyPreview } from "./RestoreBodyPreview";
import { RestoreNoteVersionPreview } from "./RestoreNoteVersionPreview";
import { DeleteSprintPreview, ManageSprintPreview } from "./SprintWritePreview";
import { DeleteTaskAttachmentPreview } from "./TaskAttachmentPreview";
import { TaskPlanPreview } from "./TaskPlanPreview";
import { CreateTodoPreview, DeleteTodoPreview, UpdateTodoPreview } from "./TodoWritePreview";
import { UpdateTaskPreview } from "./UpdateTaskPreview";

export interface ApprovalPreviewProps {
    args: Record<string, unknown>;
    // The backend predicts whether the write can be undone, and the card says so
    // itself (`UndoChip`). A preview that used to say "cannot be undone" leaves it
    // out then, so the card does not say it twice. Absent (older backends): as before.
    undoKnown?: boolean;
}

const approvalRenderers: Record<string, FC<ApprovalPreviewProps>> = {
    create_task: CreateTaskPreview,
    create_task_plan: TaskPlanPreview,
    update_task: UpdateTaskPreview,
    update_tasks_bulk: BulkUpdatePreview,
    add_comment: AddCommentPreview,
    // The two writes on a comment of the caller's own, and the description
    // restore (which is also reversible).
    update_comment: UpdateCommentPreview,
    delete_comment: DeleteCommentPreview,
    // A file on a task (AGENT_PARITY_TOOLS): the card names the file, its size and type.
    delete_task_attachment: DeleteTaskAttachmentPreview,
    restore_task_body: RestoreTaskBodyPreview,
    // One card per to-do write, and one for the milestone tool (it branches
    // on its `action`) plus one for its delete.
    update_todo_item: UpdateTodoPreview,
    create_todo_item: CreateTodoPreview,
    delete_todo_item: DeleteTodoPreview,
    manage_milestone: ManageMilestonePreview,
    delete_milestone: DeleteMilestonePreview,
    // The same split for sprints: one card for the tool that branches on its
    // `action`, one for its delete.
    manage_sprint: ManageSprintPreview,
    delete_sprint: DeleteSprintPreview,
    // Projects: one card per tool, each branching on its `action` (create or
    // change a project; add a member or change a member's role).
    manage_project: ManageProjectPreview,
    manage_project_members: ManageProjectMembersPreview,
    // A project's tag list and the team's project labels, answering a request
    // to join a project, and (in the app only) deleting a project for good.
    add_project_tag: AddProjectTagPreview,
    manage_project_labels: ManageProjectLabelsPreview,
    approve_join_request: ApproveJoinRequestPreview,
    decline_join_request: DeclineJoinRequestPreview,
    delete_project: DeleteProjectPreview,
    // One component for both note writes — it branches on the presence
    // of `note_id` in the args (only updates have one).
    create_note: NoteWritePreview,
    update_note: NoteWritePreview,
    // Note folders and favorites: a card for the folder tool (it branches on
    // its `action`) and one for starring or unstarring a note or a folder.
    manage_note_folder: ManageNoteFolderPreview,
    favorite_note: FavoriteNotePreview,
    // The note writes that can't be taken back or that change who has access:
    // two deletes, and one card for sharing that branches on its `action`.
    delete_note: DeleteNotePreview,
    delete_note_folder: DeleteNoteFolderPreview,
    manage_note_sharing: ManageNoteSharingPreview,
    // Putting an earlier version of a note back (the current text is kept as a
    // version first, so it can be undone).
    restore_note_version: RestoreNoteVersionPreview,
    // Calendar events (AGENT_PARITY_TOOLS, MIP-1059): behind `flagged` below, so the three cards a
    // member sees today do not change until the server sends what the new ones read.
    create_calendar_event: CreateCalendarEventPreview,
    update_calendar_event: UpdateCalendarEventPreview,
    delete_calendar_event: DeleteCalendarEventPreview,
};

// Tools whose structured card exists only while the server's flag is on. They pause for approval with
// the flag off too, and the card is then the key:value fallback it has always been: a renderer here
// answers only for a card whose `arguments` carry the facts the flag adds.
const flagged: Record<string, (args: Record<string, unknown>) => boolean> = {
    create_calendar_event: hasCalendarCardFacts,
    update_calendar_event: hasCalendarCardFacts,
    delete_calendar_event: hasCalendarCardFacts,
};

export const getApprovalRenderer = (
    toolName: string,
    args?: Record<string, unknown>
): FC<ApprovalPreviewProps> | undefined => {
    const gate = flagged[toolName];
    // No arguments to look at (a caller that only asks "is there a card for this tool?") is a yes.
    if (gate && args && !gate(args)) return undefined;
    return approvalRenderers[toolName];
};
