import axios from 'axios';

import { authApi } from '../../../services/api';
import { UserProps } from '../../../types/admin'
import { TaskProps } from '../../../types/tasks';

const base_url = import.meta.env.VITE_API_BASE_URL;

export const sendUpdatedSpecificTask = async (
    myself: UserProps,
    updatedData: TaskProps,
    accessToken: string | null,
    setErrorMessage?: (value: string) => void,
) => {
    try {
        if (updatedData.project === null) {
            if (setErrorMessage) {
                setErrorMessage("Project ID is not specified.")
            }
            return [];
        }

        const api = authApi(accessToken);

        if (api) {
            const res = await api.put("/task/updateTask/",
                {
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
                });

            if (res) {
                for (const attachment of updatedData.attachments) {
                    const formData = new FormData()
                    formData.append("task", String(updatedData.id))
                    formData.append("attached_file", attachment.file)
                    formData.append("attached_type", attachment.file.type)

                    const uploadAttachmentResponse = await fetch(`${base_url}/task/addTaskAttachment/`, {
                        method: 'POST',
                        headers: {
                            "Authorization": `Bearer ${accessToken}`
                        },
                        body: formData,
                    });

                    const uploadAttachmentData = await uploadAttachmentResponse.json();
                    console.log("uploadAttachmentData (update task):", uploadAttachmentData)

                    if (!uploadAttachmentResponse.ok) {
                        throw new Error(uploadAttachmentData.message || 'Attachment Upload Failed');
                    }
                }

                return res.data
            }
        } else {
            console.error('Unauthorized. Auth toke is not found.');
            if (setErrorMessage) {
                setErrorMessage('Unauthorized. Auth toke is not found.')
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error('Message Id already exists.');
                if (setErrorMessage) {
                    setErrorMessage('Message Id already exists.')
                }
            } else if (error.response?.status === 401) {
                console.error('Unauthorized. Please log in again.');
                if (setErrorMessage) {
                    setErrorMessage('Unauthorized. Please log in again.')
                }
            } else {
                console.error('API error:', error.response?.status, error.response?.data);
            }
        } else {
            console.error('Unexpected error:', error);
        }
    }
}
