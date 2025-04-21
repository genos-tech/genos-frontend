import { LoadSearchListResponse, SearchListProps, UserProps } from '../../../types'

const base_url = import.meta.env.VITE_API_BASE_URL;

type LoadSearchListProps = {
    myself: UserProps;
    accessToken: string;
};

async function loadSearchList(props: LoadSearchListProps): Promise<SearchListProps[]> {
    const { myself, accessToken } = props
    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return [];
    }

    try {
        const response = await fetch(`${base_url}/search/teamMembersAndGroups/?user_id=${myself.userId}&team_id=${myself.teamId}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
        });

        const data: LoadSearchListResponse = await response.json();

        if (!response.ok) {
            const errorMsg = data.message || "Failed to get all users";
            throw new Error(errorMsg);
        }
        return data.searchList || [];

    } catch (error) {
        const errorMsg =
            error instanceof Error
                ? error.message
                : "An unknown error occurred during chat group creation.";

        console.error(errorMsg);
        return [];
    }

}

export default loadSearchList;
