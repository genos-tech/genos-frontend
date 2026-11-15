/**
 * The `code` of the HTTP 400 genos-api answers a project MOVE with, for a task
 * (`PUT /task/`) and for a milestone (`PATCH /milestone/<id>/`), when an
 * assignee of the moved task, milestone or one of their sub-tasks is on neither
 * the destination project nor its team (MIP-1597). Nothing was changed; the
 * body's `error` names the tasks by display id.
 */
export const ASSIGNEE_NOT_ON_DESTINATION = "assignee_not_on_destination";
