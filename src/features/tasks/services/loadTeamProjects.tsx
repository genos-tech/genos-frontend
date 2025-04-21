import { ProjectProps, UserProps } from '../../../types/types'

const base_url = import.meta.env.VITE_API_BASE_URL;

type LoadSearchListProps = {
    myself: UserProps;
    accessToken: string;
};

async function loadTeamProjects(props: LoadSearchListProps): Promise<ProjectProps[]> {
    const { myself, accessToken } = props
    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return [];
    }

    try {
        const response = await fetch(`${base_url}/project/getTeamProjects/?team_id=${myself.teamId}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
        });

        const data: ProjectProps[] = await response.json();

        if (!response.ok) {
            const errorMsg = "Failed to get team projects";
            throw new Error(errorMsg);
        }
        return data || [];

    } catch (error) {
        const errorMsg =
            error instanceof Error
                ? error.message
                : "An unknown error occurred during fetching all projects.";

        console.error(errorMsg);
        return [];
    }

}

export default loadTeamProjects;
