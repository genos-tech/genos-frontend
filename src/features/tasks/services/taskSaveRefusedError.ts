import { TaskNotSavedError } from "./taskNotSavedError";

/**
 * The server answered a task save with HTTP 400: it looked at the request and
 * refused it (an assignee who is not on the project, a custom-field value of
 * the wrong shape, a sub-task project move, ...). Nothing was written.
 *
 * Thrown by `sendUpdatedSpecificTask`, which has ALREADY shown the person the
 * reason by the time this reaches a caller. What is left to the caller is
 * putting its own copy of the task back to what the server holds, because the
 * working copy now carries a value that was never stored. Every other failure
 * (network, 5xx, 401) is NOT this error: `sendUpdatedSpecificTask` reports it through
 * `onNotSaved` instead of throwing.
 */
export class TaskSaveRefusedError extends TaskNotSavedError {
    /** The server's own sentence (`error` in the body), or the translated
     *  sub-task message for that code. `null` when the body had no single
     *  sentence, e.g. a DRF field-error map. */
    readonly serverMessage: string | null;
    /** The server's machine-readable `code`, when it sent one. */
    readonly code: string | null;
    /** The id of the COLLABORATOR the server refused because they could not
     *  open the task (a teammate who is not on the project, MIP-1567), or
     *  `null` for any other refusal. Nothing else in the save was at fault,
     *  so a caller can drop that one person and send the rest again instead
     *  of discarding the whole edit. */
    readonly refusedCollaboratorId: string | null;

    constructor(
        serverMessage: string | null,
        code: string | null = null,
        refusedCollaboratorId: string | null = null
    ) {
        super(serverMessage ?? "The server refused to save this task.");
        this.name = "TaskSaveRefusedError";
        this.serverMessage = serverMessage;
        this.code = code;
        this.refusedCollaboratorId = refusedCollaboratorId;
    }
}
