import { TaskListByTagProps, UserProps } from '../../../types'

const base_url = import.meta.env.VITE_API_BASE_URL;

type LoadTaskTableProps = {
    myself: UserProps;
    accessToken: string;
};

async function loadTeamTaskListByTag(props: LoadTaskTableProps): Promise<TaskListByTagProps[]> {
    const { myself, accessToken } = props
    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return [];
    }

    try {
        const response = await fetch(`${base_url}/task/getTeamTasksByTag/?team_id=${myself.teamId}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
        });

        const data: TaskListByTagProps[] = await response.json();

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

export default loadTeamTaskListByTag;
