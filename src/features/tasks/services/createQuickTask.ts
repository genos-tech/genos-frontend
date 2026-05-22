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
};

// Title-only task create. The full CreateTaskForm flow does POST-empty
// then PUT-real-data so its body editor has a task_id to attach files to
// before save; that two-step is unnecessary when the user just wants a
// row with a title. One POST with `is_init_task: false` and a real title
// is enough — the backend's TaskMasterView.post writes the real row and
// the post-save signal claims the project_task_number.
export const createQuickTask = async (props: CreateQuickTaskProps): Promise<void> => {
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
        assignee: myself.userId,
        reporter: myself.userId,
        title,
        priority: null,
        effort_level: null,
        status: "Open",
        // Ship the same default body scaffold the rich CreateTaskForm starts
        // with. A title-only task that opens to an empty BlockNote editor
        // feels unfinished and gives the user nothing to flesh out — the
        // default template's Summary / Motivation / Acceptance / Notes
        // sections are the prompt to add detail later.
        content: taskContentTemplate,
        due_date: null,
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
};
