import axios from "axios";

import { emitRequestError } from "../../../../services/requestErrorNotifier";
import { UserProps } from "../../../../types/admin";
import { collaboratorRefusalText, refusedCollaboratorId } from "../../utils/collaboratorRefusal";
import { ASSIGNEE_NOT_ON_DESTINATION } from "../../utils/moveRefusal";

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
    /** Called after the reason is shown, when a project MOVE was refused because
     *  an assignee in the moved set is not on the destination project or its
     *  team (`assignee_not_on_destination`, MIP-1597). The server changed
     *  nothing, so the milestone is still where it was. */
    onMoveRefused?: () => void;
    /** Called when the save stored nothing, whatever the reason. `retry` is false when sending
     *  it again cannot help. The description autosave needs this (MIP-2443). */
    onNotSaved?: (retry: boolean) => void;
};

/**
 * Show the reason for a refused milestone save (a collaborator who could not
 * open it, or a move that would leave an assignee outside the destination).
 * Does nothing for any other
 * failure, which keeps its old behaviour (the generic toast from the API
 * client's interceptor, then `undefined`).
 */
export const reportMilestoneRefusal = (error: unknown, hooks?: MilestoneRefusalHooks): void => {
    if (!axios.isAxiosError(error) || error.response?.status !== 400) return;
    const body = error.response.data as { error?: unknown; code?: unknown } | undefined;
    const text = body?.error;
    const serverText = typeof text === "string" && text ? text : null;
    // The sentence names the tasks by display id, so it is shown as the server
    // wrote it (the same way a refused task move is).
    if (body?.code === ASSIGNEE_NOT_ON_DESTINATION) {
        if (serverText) emitRequestError("serverMessage", serverText);
        hooks?.onMoveRefused?.();
        return;
    }
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
