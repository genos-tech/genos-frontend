import { ChatProps, LoadDMMessageHistoryResponse } from '../../types';

const base_url = import.meta.env.VITE_API_BASE_URL;

type LoadDMHistoryProps = {
    userEmail: string;
    dmEmail: string;
};

async function loadSpecificDMHistory(props: LoadDMHistoryProps): Promise<ChatProps[]> {
    const { userEmail, dmEmail } = props;

    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return Promise.resolve([]);
    }

    return fetch(`${base_url}/message/DMHistory/?userEmail=${userEmail}&dmEmail=${dmEmail}`, {
        method: "GET",
        credentials: "include",
        headers: {
            'Content-Type': 'application/json',
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

export default loadSpecificDMHistory;
