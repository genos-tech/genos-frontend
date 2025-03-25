import { ChatProps, LoadGMMessageHistoryResponse } from '../../types';

const base_url = import.meta.env.VITE_API_BASE_URL;

type LoadGMHistoryProps = {
    userEmail: string;
    accessToken: string;
};

async function loadGMHistory(props: LoadGMHistoryProps): Promise<ChatProps[]> {
    const { userEmail, accessToken } = props;

    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return Promise.resolve([]);
    }

    return fetch(`${base_url}/gm/getHistory/?user_email=${userEmail}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        },
    })
        .then(response => response.json().then(data => ({ response, data })))
        .then(({ response, data }: { response: Response; data: LoadGMMessageHistoryResponse }) => {
            if (!response.ok) {
                const errorMsg = data.message || "Failed to get chat history";
                throw new Error(errorMsg);
            }
            return data.messageHistory || [];
        })
        .catch(error => {
            const errorMsg =
                error instanceof Error
                    ? error.message
                    : "An unknown error occurred during chat history extraction.";

            console.error(errorMsg);
            return [];
        });
}

export default loadGMHistory;
