import { UserProps } from "../../../types/admin";
import { taskContentTemplate } from "../utils/taskTemplates";

const base_url = import.meta.env.VITE_API_BASE_URL;

type CreateQuickTaskProps = {
    myself: UserProps;
    accessToken: string | null;
    projectId: number;
    title: string;
    parentTaskId: number;
    rootTaskId: number;
    milestoneId: number | null;
    // Optional metadata for callers that expose more than a title input
    // (the table's quick-add row). Defaults preserve the original
    // title-only behavior for existing callers (TaskSubTasksBlock):
    // `assigneeId` undefined = assign to the creator; explicit null =
    // unassigned (the backend accepts null — createEmptyTask already
    // sends `assignee: null`).
    assigneeId?: string | null;
    status?: string;
    priority?: string | null;
    effortLevel?: string | null;
    // "YYYY-MM-DD"
    dueDate?: string | null;
};

export type CreateQuickTaskResult = {
    // task_id of the created row, or null if the response body couldn't
    // be parsed. `display_id` is intentionally NOT surfaced: the
    // post-save signal claims project_task_number after serialization,
    // so the POST response may not carry it yet.
    taskId: number | null;
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
        assignee: props.assigneeId === undefined ? myself.userId : props.assigneeId,
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
        content: taskContentTemplate,
        due_date: props.dueDate ?? null,
        links: null,
        tags: [],
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
        throw new Error(`Quick task create failed (${res.status})`);
    }

    const json = await res.json().catch(() => null);
    const rawId = json?.task?.task_id;
    const numericId = Number(rawId);
    return { taskId: Number.isFinite(numericId) && rawId != null ? numericId : null };
};
