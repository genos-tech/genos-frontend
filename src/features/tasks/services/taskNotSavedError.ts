import axios from "axios";

import { emitRequestError } from "../../../services/requestErrorNotifier";

/**
 * A table or board edit stored nothing (MIP-2582): whoever shows the new value must put the old
 * one back. `TaskSaveRefusedError` (the server said no, with a reason) is the special case.
 */
export class TaskNotSavedError extends Error {
    constructor(message = "The task was not saved.") {
        super(message);
        this.name = "TaskNotSavedError";
    }
}

/**
 * Say that an inline edit was not saved. The API client has already toasted a failed response,
 * and the newest toast wins: a 403 or an archived project keeps that sentence, which says why.
 */
export const reportTaskNotSaved = (error?: unknown): void => {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const code = (error.response?.data as { code?: unknown } | undefined)?.code;
        if (status === 403 || (status === 409 && code === "archived")) return;
    }
    emitRequestError("changeNotSaved");
};
