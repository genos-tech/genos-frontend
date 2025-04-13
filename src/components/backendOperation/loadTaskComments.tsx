import { UserProps, TaskCommentProps } from '../../types'

const base_url = import.meta.env.VITE_API_BASE_URL;

type LoadTaskCommentsProps = {
    myself: UserProps;
    taskId: number;
    accessToken: string;
};

async function loadTaskComments(props: LoadTaskCommentsProps): Promise<TaskCommentProps[]> {
    const { myself, taskId, accessToken } = props
    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return [];
    }

    try {
        const response = await fetch(`${base_url}/task/getComments/?task_id=${taskId}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
        });

        const data: TaskCommentProps[] = await response.json();

        if (!response.ok) {
            const errorMsg = "Failed to get task comments";
            throw new Error(errorMsg);
        }
        return data || [];

    } catch (error) {
        const errorMsg =
            error instanceof Error
                ? error.message
                : "An unknown error occurred during fetching task comments.";

        console.error(errorMsg);
        return [];
    }

}

export default loadTaskComments;
