import { PreviewTaskProps, UserProps } from '../../../types/types'

const base_url = import.meta.env.VITE_API_BASE_URL;

type UpdateTaskProps = {
    myself: UserProps;
    updatedData: PreviewTaskProps;
    accessToken: string;
};

async function updateSpecificTask(props: UpdateTaskProps): Promise<PreviewTaskProps[]> {
    const { myself, updatedData, accessToken } = props
    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        return [];
    }

    try {
        const response = await fetch(`${base_url}/task/updateTask/`, {
            method: "PUT",
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                task_id: updatedData.id,
                team: myself.teamId,
                project: updatedData.project.projectId,
                thread_id: updatedData.threadId,
                parent_task_id: updatedData.parentTaskId,
                assignee: updatedData.assignee.userId,
                reporter: updatedData.reporter.userId,
                title: updatedData.title,
                priority: (updatedData.priority !== null) ? updatedData.priority.priority : null,
                effort_level: (updatedData.effortLevel !== null) ? updatedData.effortLevel.level : null,
                status: (updatedData.status.status !== null) ? updatedData.status.status : null,
                content: (updatedData.body.length !== 0) ? updatedData.body : null,
                due_date: (updatedData.dueDate !== "") ? updatedData.dueDate : null,
                github_url: (updatedData.githubLink.url !== "") ? updatedData.githubLink.url : null,
                github_url_title: (updatedData.githubLink.title !== "") ? updatedData.githubLink.title : null,
                general_url: (updatedData.generalLink.url !== "") ? updatedData.generalLink.url : null,
                general_url_title: (updatedData.generalLink.title !== "") ? updatedData.generalLink.title : null,
                tags: updatedData.tags,
            }),
        });

        const data: PreviewTaskProps[] = await response.json();

        if (!response.ok) {
            const errorMsg = "Failed to update a task";
            throw new Error(errorMsg);
        }
        return data || [];

    } catch (error) {
        const errorMsg =
            error instanceof Error
                ? error.message
                : "An unknown error occurred during updating a task.";

        console.error(errorMsg);
        return [];
    }

}

export default updateSpecificTask;
