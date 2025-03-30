import { ChatProps, LoadDMMessageHistoryResponse } from '../../types';

const base_url = import.meta.env.VITE_API_BASE_URL;

type LoadDMHistoryProps = {
    userId: string;
    accessToken: string;
};

async function loadDMHistory(props: LoadDMHistoryProps): Promise<ChatProps[]> {
    const { userId, accessToken } = props;

    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return Promise.resolve([]);
    }

    return fetch(`${base_url}/dm/getHistory/?user_id=${userId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        },
    })
        .then(response => response.json().then(data => ({ response, data })))
        .then(({ response, data }: { response: Response; data: LoadDMMessageHistoryResponse }) => {
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

export default loadDMHistory;
