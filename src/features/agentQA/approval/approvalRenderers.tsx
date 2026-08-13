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
import { CreateTaskPreview } from "./CreateTaskPreview";
import { NoteWritePreview } from "./NoteWritePreview";
import { TaskPlanPreview } from "./TaskPlanPreview";
import { UpdateTaskPreview } from "./UpdateTaskPreview";

export interface ApprovalPreviewProps {
    args: Record<string, unknown>;
    isDark: boolean;
}

const approvalRenderers: Record<string, FC<ApprovalPreviewProps>> = {
    create_task: CreateTaskPreview,
    create_task_plan: TaskPlanPreview,
    update_task: UpdateTaskPreview,
    update_tasks_bulk: BulkUpdatePreview,
    add_comment: AddCommentPreview,
    // One component for both note writes — it branches on the presence
    // of `note_id` in the args (only updates have one).
    create_note: NoteWritePreview,
    update_note: NoteWritePreview,
};

export const getApprovalRenderer = (toolName: string): FC<ApprovalPreviewProps> | undefined =>
    approvalRenderers[toolName];
