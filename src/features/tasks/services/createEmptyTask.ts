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
                assignee: myself.userId,
                reporter: myself.userId,
                title: "empty task for creating new one",
                priority: null,
                effort_level: null,
                status: "Open",
                content: [],
                due_date: null,
                github_url: null,
                github_url_title: null,
                general_url: null,
                general_url_title: null,
                tags: [],
                chat_type: null,
                chat_id: null,
                thread_id: null,
                parent_task_id: null,
                root_task_id: null,
                is_init_table: true,
            }),
        });

        const taskCreateData = await taskCreateResponse.json();

        if (!taskCreateResponse.ok) {
            throw new Error("Failed to create a task");
        } else {
            setInitialEmptyTaskId(taskCreateData.task_id);
        }
    }
};
