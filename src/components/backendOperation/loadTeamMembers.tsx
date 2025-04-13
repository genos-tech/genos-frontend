import { UserProps } from '../../types'

const base_url = import.meta.env.VITE_API_BASE_URL;

type LoadTeamMembersProps = {
    myself: UserProps;
    accessToken: string;
};

async function loadTeamMembers(props: LoadTeamMembersProps): Promise<UserProps[]> {
    const { myself, accessToken } = props
    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return [];
    }

    try {
        const response = await fetch(`${base_url}/team/getTeamMembers/?team_id=${myself.teamId}&user_id=${myself.userId}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
        });

        const data: UserProps[] = await response.json();

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

export default loadTeamMembers;
