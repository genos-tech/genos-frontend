// What an UNDONE write changes in the browser, beyond the transcript.
//
// The undo runs on the server, through the same service calls the app's own
// pages make, so this only nudges the surfaces that hold their own copy. It
// mirrors, event for event, what each kind of write already does:
//
//   task, restored   an approved `update_task` / `restore_task_body`:
//                    `emitTasksBulkChanged(projectId)` (the table, the diagram and the
//                    milestone list re-read, and an OPEN preview whose row is now newer
//                    reloads itself, `useProjectTaskManagement`) and
//                    `emitTaskTouched(id, "update")` (its Activity feed, which has a
//                    new row; what `RestoreBodyControl` emits after a restore).
//   task, deleted    undoing `create_task`. The server soft-deletes it (status
//                    "Deleted"), as a task delete does everywhere. The same two events: the
//                    row comes back with status "Deleted" and the open preview
//                    reloads onto it, the same road any remote delete takes.
//   comment, deleted undoing `add_comment`. `emitTaskTouched(id, "comment")`, what
//                    `deleteTaskComment` emits: the open task re-reads its
//                    comments and activity.
//   note             `emitNoteChanged` with the ref an approved note write sends:
//                    `deleted: true` for undoing `create_note` (the sidebar and open
//                    tabs drop it), `changed_fields: ["title","body"]` for undoing an
//                    edit (the note is re-read and its body pushed into its Yjs doc,
//                    which also covers a `live_editor` push that failed).
//
// Called from the undo store's request completion, ONCE per undo.

import type { UndoAnswer } from "../../services/agentApi";
import { emitTasksBulkChanged, emitTaskTouched } from "../tasks/services/taskEvents";
import { emitNoteChanged } from "./noteWriteTools";

export const emitUndone = (answer: UndoAnswer): void => {
    const entity = answer.entity;
    if (!entity) return;
    if (entity.kind === "task") {
        emitTasksBulkChanged(entity.project_id ?? undefined);
        emitTaskTouched(entity.task_id, "update");
        return;
    }
    if (entity.kind === "comment") {
        emitTaskTouched(entity.task_id, "comment");
        return;
    }
    // A note: the family is "personal" | "task" | "chat", as on a note ref.
    const base = { note_id: entity.note_id, note_type: entity.note_type, title: entity.title };
    emitNoteChanged(
        answer.tool_name,
        answer.action === "deleted"
            ? { ...base, deleted: true }
            : {
                  ...base,
                  // An edit's undo puts back the title and the body, both.
                  changed_fields: answer.restored.length > 0 ? answer.restored : ["title", "body"],
              }
    );
};
