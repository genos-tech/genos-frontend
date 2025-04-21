import { TaskTableProps, UserProps } from '../../../types/types'

const base_url = import.meta.env.VITE_API_BASE_URL;

type LoadTaskTableProps = {
    myself: UserProps;
    accessToken: string;
};

async function loadTeamTasks(props: LoadTaskTableProps): Promise<TaskTableProps[]> {
    const { myself, accessToken } = props
    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return [];
    }

    try {
        const response = await fetch(`${base_url}/task/getTeamTasks/?team_id=${myself.teamId}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
        });

        const data: TaskTableProps[] = await response.json();

        if (!response.ok) {
            const errorMsg = "Failed to get tasks";
            throw new Error(errorMsg);
        }
        return data || [];

    } catch (error) {
        const errorMsg =
            error instanceof Error
                ? error.message
                : "An unknown error occurred during loading task list.";

        console.error(errorMsg);
        return [];
    }

}

export default loadTeamTasks;
