import { getMessages } from "../../../i18n";
import { UserProps } from "../../../types/admin";

const base_url = import.meta.env.VITE_API_BASE_URL;

type createEmptyTaskProps = {
    myself: UserProps;
    projectId: number;
    accessToken: string | null;
    /** Lets the caller time the request out. A fetch that never settles is
     *  otherwise unrecoverable and leaves the create form spinning. */
    signal?: AbortSignal;
};

/**
 * Create the backend scaffold row that the create-task form edits in place.
 *
 * **Resolves with the new task id, or throws — it never resolves empty.**
 * The form has nothing to render until this id exists, so every failure has
 * to reach the caller. Previously a missing `accessToken` made this return
 * silently and the form sat on its loading pane forever, with nothing in the
 * console to explain it.
 */
export const createEmptyTask = async (props: createEmptyTaskProps): Promise<number> => {
    const { myself, projectId, accessToken, signal } = props;
    const errMsgs = getMessages().tasks.errors;

    if (!accessToken) {
        throw new Error(errMsgs.createTaskFailed);
    }

    const taskCreateResponse = await fetch(`${base_url}/task/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        signal,
        body: JSON.stringify({
            team: myself.teamId,
            project: projectId,
            // Empty-task scaffold starts unassigned to match the
            // form's default — the real submit PUT overwrites the
            // assignee with whatever the user picks (or leaves null).
            assignee: null,
            reporter: myself.userId,
            title: "<new task>",
            priority: null,
            effort_level: null,
            status: "Open",
            content: [],
            due_date: null,
            links: null,
            tags: [],
            chat_type: null,
            chat_id: null,
            thread_id: null,
            parent_task_id: null,
            root_task_id: null,
            is_init_task: true,
        }),
    });

    // Ok-check BEFORE parsing: an error response that isn't JSON (a proxy's
    // 502 HTML page, say) would otherwise throw an opaque SyntaxError here
    // instead of the real failure.
    if (!taskCreateResponse.ok) {
        throw new Error(errMsgs.createTaskFailed);
    }

    const taskCreateData = await taskCreateResponse.json();
    const taskId = taskCreateData?.task?.task_id;
    // A 200 with an unexpected body is still a failure for our purposes:
    // seeding the form with `undefined` just reproduces the endless loading
    // pane one layer up.
    if (typeof taskId !== "number") {
        throw new Error(errMsgs.createTaskFailed);
    }
    return taskId;
};
