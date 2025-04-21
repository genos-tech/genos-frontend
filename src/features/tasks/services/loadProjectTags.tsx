import { UserProps, TagListProps } from '../../../types/types'

const base_url = import.meta.env.VITE_API_BASE_URL;

type LoadTeamMembersProps = {
    myself: UserProps;
    projectId: number;
    accessToken: string;
};

async function loadProjectTags(props: LoadTeamMembersProps): Promise<TagListProps[]> {
    const { myself, projectId, accessToken } = props
    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return [];
    }

    try {
        const response = await fetch(`${base_url}/project/getProjectTags/?team_id=${myself.teamId}&project_id=${projectId}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
        });

        const data: TagListProps[] = await response.json();

        if (!response.ok) {
            const errorMsg = "Failed to get project tags";
            throw new Error(errorMsg);
        }
        return data || [];

    } catch (error) {
        const errorMsg =
            error instanceof Error
                ? error.message
                : "An unknown error occurred during fetching project tags.";

        console.error(errorMsg);
        return [];
    }

}

export default loadProjectTags;
