import { getMessages } from "../../../i18n";
import { UserProps } from "../../../types/admin";

const base_url = import.meta.env.VITE_API_BASE_URL;

type createEmptyTaskProps = {
    myself: UserProps;
    projectId: number;
    accessToken: string | null;
    setInitialEmptyTaskId: (value: number) => void;
};

export const createEmptyTask = async (props: createEmptyTaskProps) => {
    const { myself, projectId, accessToken, setInitialEmptyTaskId } = props;

    if (accessToken) {
        const taskCreateResponse = await fetch(`${base_url}/task/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
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

        const taskCreateData = await taskCreateResponse.json();

        if (!taskCreateResponse.ok) {
            throw new Error(getMessages().tasks.errors.createTaskFailed);
        } else {
            setInitialEmptyTaskId(taskCreateData.task.task_id);
        }
    }
};
