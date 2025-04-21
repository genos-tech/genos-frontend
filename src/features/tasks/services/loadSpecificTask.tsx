import { PreviewTaskProps, UserProps } from '../../../types'

const base_url = import.meta.env.VITE_API_BASE_URL;

type LoadTaskTableProps = {
    myself: UserProps;
    projectId: number;
    taskId: number;
    accessToken: string;
};

async function loadSpecificTask(props: LoadTaskTableProps): Promise<PreviewTaskProps[]> {
    const { myself, projectId, taskId, accessToken } = props
    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return [];
    }

    try {
        const response = await fetch(`${base_url}/task/getTask/?team_id=${myself.teamId}&project_id=${projectId}&task_id=${taskId}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
        });

        const data: PreviewTaskProps[] = await response.json();

        if (!response.ok) {
            const errorMsg = "Failed to get a task";
            throw new Error(errorMsg);
        }
        return data || [];

    } catch (error) {
        const errorMsg =
            error instanceof Error
                ? error.message
                : "An unknown error occurred during loading a task.";

        console.error(errorMsg);
        return [];
    }

}

export default loadSpecificTask;
