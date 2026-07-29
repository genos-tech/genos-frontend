import { fmt, getMessages } from "../../../i18n";
import { LimitReachedError, parseLimitReached } from "../../../services/limitErrors";
import { UserProps } from "../../../types/admin";
import { TagListProps } from "../../../types/tasks";
import { taskContentTemplate } from "../utils/taskTemplates";

const base_url = import.meta.env.VITE_API_BASE_URL;

type CreateQuickTaskProps = {
    myself: UserProps;
    accessToken: string | null;
    projectId: number;
    title: string;
    // Null on both = a ROOT task (no parent, no chain). The backend
    // reads these with `.get(..., None)`, and the create form's own
    // bootstrap POST already sends nulls — the sub-task callers pass
    // real ids.
    parentTaskId: number | null;
    rootTaskId: number | null;
    milestoneId: number | null;
    // Optional metadata for callers that expose more than a title input
    // (the table's quick-add row). New tasks default to unassigned — pass
    // `assigneeId` to set one. The backend accepts null (createEmptyTask
    // already sends `assignee: null`).
    assigneeId?: string | null;
    status?: string;
    priority?: string | null;
    effortLevel?: string | null;
    // "YYYY-MM-DD"
    dueDate?: string | null;
    // Full tag objects, same shape uploadNewTask sends.
    tags?: TagListProps[];
    // Body blocks. Defaults to the standard Summary/Motivation/
    // Acceptance/Notes scaffold; pass a value when the caller already
    // has real content to carry over (converting a to-do keeps the
    // to-do's notes).
    content?: unknown;
};

export type CreateQuickTaskResult = {
    // task_id of the created row, or null if the response body couldn't
    // be parsed.
    taskId: number | null;
    // Friendly "<code>-<n>" id computed by the backend. The POST handler
    // surfaces it (mirroring PUT / getProjectTasks) so a freshly created
    // row can render it immediately instead of flashing "#<id>". Null
    // when the backend build predates that change, or when the project
    // has no code / the number wasn't assigned — callers fall back to
    // "#<id>" via `formatTaskDisplayId`.
    displayId: string | null;
};

// Title-only task create. The full CreateTaskForm flow does POST-empty
// then PUT-real-data so its body editor has a task_id to attach files to
// before save; that two-step is unnecessary when the user just wants a
// row with a title. One POST with `is_init_task: false` and a real title
// is enough — the backend's TaskMasterView.post writes the real row and
// the post-save signal claims the project_task_number.
export const createQuickTask = async (
    props: CreateQuickTaskProps
): Promise<CreateQuickTaskResult> => {
    const { myself, accessToken, projectId, title, parentTaskId, rootTaskId, milestoneId } = props;

    if (!accessToken) {
        throw new Error("Missing access token");
    }

    // TaskMasterView.post reads several keys via `request.data["..."]`
    // (KeyError on missing keys). Send every required key — values may
    // be null, but the keys must be present. Optional keys (milestone,
    // sprint, chat_*) are only included when set so the backend's
    // None-strip behavior doesn't accidentally clear them.
    const body: Record<string, unknown> = {
        team: myself.teamId,
        project: projectId,
        assignee: props.assigneeId ?? null,
        reporter: myself.userId,
        title,
        priority: props.priority ?? null,
        effort_level: props.effortLevel ?? null,
        status: props.status ?? "Open",
        // Ship the same default body scaffold the rich CreateTaskForm starts
        // with. A title-only task that opens to an empty BlockNote editor
        // feels unfinished and gives the user nothing to flesh out — the
        // default template's Summary / Motivation / Acceptance / Notes
        // sections are the prompt to add detail later.
        content: props.content ?? taskContentTemplate,
        due_date: props.dueDate ?? null,
        links: null,
        tags: props.tags ?? [],
        chat_type: null,
        chat_id: null,
        thread_id: null,
        parent_task_id: parentTaskId,
        root_task_id: rootTaskId,
        is_init_task: false,
    };
    if (milestoneId != null) {
        body.milestone = milestoneId;
    }

    const res = await fetch(`${base_url}/task/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        // Plan limit (429 limit_reached): typed error so the quick-add
        // row can render the limit message inline instead of the
        // generic failure copy.
        const limitErr = await parseLimitReached(res);
        if (limitErr) {
            const errMsgs = getMessages().tasks.errors;
            throw new LimitReachedError(
                limitErr.limit != null
                    ? fmt(errMsgs.taskLimitReached, {
                          used: String(limitErr.used ?? limitErr.limit),
                          limit: String(limitErr.limit),
                      })
                    : limitErr.message || errMsgs.createTaskFailed,
                limitErr
            );
        }
        throw new Error(`Quick task create failed (${res.status})`);
    }

    const json = await res.json().catch(() => null);
    const rawId = json?.task?.task_id;
    const numericId = Number(rawId);
    const rawDisplayId = json?.task?.displayId;
    return {
        taskId: Number.isFinite(numericId) && rawId != null ? numericId : null,
        displayId: typeof rawDisplayId === "string" && rawDisplayId !== "" ? rawDisplayId : null,
    };
};
