import axios from "axios";

import { emitRequestError } from "../../../../services/requestErrorNotifier";
import { UserProps } from "../../../../types/admin";
import { collaboratorRefusalText, refusedCollaboratorId } from "../../utils/collaboratorRefusal";

/**
 * What a milestone save may tell its caller about being refused (MIP-1567).
 *
 * `createMilestone` / `updateMilestone` swallow every failure and answer
 * `undefined`, and the callers that matter (the create form, the preview's
 * field save) keep the person's edits on screen. For ONE refusal that is not
 * enough: a collaborator who could not open the task is named in the 400, and
 * if the working copy keeps them every later save sends them again and is
 * refused again, so unrelated edits stop saving too.
 */
export type MilestoneRefusalHooks = {
    /** The people on the form, to put a name where the server wrote an id. */
    people?: ReadonlyArray<Pick<UserProps, "userId" | "userName">>;
    /** Called with the refused collaborator's id, after the reason is shown. */
    onCollaboratorRefused?: (userId: string) => void;
};

/**
 * Show the reason for a refused milestone save. Does nothing for any other
 * failure, which keeps its old behaviour (the generic toast from the API
 * client's interceptor, then `undefined`).
 */
export const reportMilestoneRefusal = (error: unknown, hooks?: MilestoneRefusalHooks): void => {
    if (!axios.isAxiosError(error) || error.response?.status !== 400) return;
    const text = (error.response.data as { error?: unknown } | undefined)?.error;
    const serverText = typeof text === "string" && text ? text : null;
    const refusedId = refusedCollaboratorId(serverText);
    if (!refusedId) return;
    // Shown AFTER the interceptor's generic toast, and the snackbar keeps the
    // newest, so the reason is what stays on screen (as for a task save).
    emitRequestError(
        "serverMessage",
        collaboratorRefusalText(serverText, hooks?.people) ?? serverText!
    );
    hooks?.onCollaboratorRefused?.(refusedId);
};
