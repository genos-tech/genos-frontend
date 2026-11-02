/**
 * The server answered a task save with HTTP 400: it looked at the request and
 * refused it (an assignee who is not on the project, a custom-field value of
 * the wrong shape, a sub-task project move, ...). Nothing was written.
 *
 * Thrown by `sendUpdatedSpecificTask`, which has ALREADY shown the person the
 * reason by the time this reaches a caller. What is left to the caller is
 * putting its own copy of the task back to what the server holds, because the
 * working copy now carries a value that was never stored. Every other failure
 * (network, 5xx, 401) is NOT this error and keeps its old, non-throwing path.
 */
export class TaskSaveRefusedError extends Error {
    /** The server's own sentence (`error` in the body), or the translated
     *  sub-task message for that code. `null` when the body had no single
     *  sentence, e.g. a DRF field-error map. */
    readonly serverMessage: string | null;
    /** The server's machine-readable `code`, when it sent one. */
    readonly code: string | null;

    constructor(serverMessage: string | null, code: string | null = null) {
        super(serverMessage ?? "The server refused to save this task.");
        this.name = "TaskSaveRefusedError";
        this.serverMessage = serverMessage;
        this.code = code;
    }
}
