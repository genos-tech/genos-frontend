import { SearchTeamTasksResponse, UserProps } from '../../../types'

const base_url = import.meta.env.VITE_API_BASE_URL;

type LoadSearchListProps = {
    myself: UserProps;
    accessToken: string;
};

async function loadTeamTaskList(props: LoadSearchListProps): Promise<SearchTeamTasksResponse[]> {
    const { myself, accessToken } = props
    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return [];
    }

    try {
        const response = await fetch(`${base_url}/search/getTeamTasks/?team_id=${myself.teamId}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
        });

        const data: SearchTeamTasksResponse[] = await response.json();

        if (!response.ok) {
            const errorMsg = "Failed to get team tasks";
            throw new Error(errorMsg);
        }
        return data || [];

    } catch (error) {
        const errorMsg =
            error instanceof Error
                ? error.message
                : "An unknown error occurred during fetching all tasks.";

        console.error(errorMsg);
        return [];
    }

}

export default loadTeamTaskList;
