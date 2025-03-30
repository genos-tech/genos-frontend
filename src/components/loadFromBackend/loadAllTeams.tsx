const base_url = import.meta.env.VITE_API_BASE_URL;

export type AllTeam = {
    team_id: string,
    team_name: string,
    team_email: string
}

type LoadAllTeam = {
    accessToken: string;
};

async function loadAllTeams(props: LoadAllTeam): Promise<AllTeam[]> {
    const { accessToken } = props
    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return [];
    }

    try {
        const response = await fetch(`${base_url}/team/getAllTeams/`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
        });

        const data: AllTeam[] = await response.json();

        if (!response.ok) {
            const errorMsg = "Failed to get all teams";
            throw new Error(errorMsg);
        }

        return data || [];

    } catch (error) {
        const errorMsg =
            error instanceof Error
                ? error.message
                : "An unknown error occurred during fetching team info.";

        console.error(errorMsg);
        return [];
    }

}

export default loadAllTeams;
