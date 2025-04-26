import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";

const base_url = import.meta.env.VITE_API_BASE_URL;

type uploadTaskProps = {
    myself: UserProps,
    taskContents: TaskProps,
    isDm: boolean | null,
    chatId: number | null,
    threadId: number | null,
    accessToken: string,
    setIsSubmitted: (value: boolean) => void,
    setTitleError: (value: string) => void,
    setTitleErrorOpen: (value: boolean) => void,
    setCurrentPreviewTaskId: (value: number) => void
}

export const uploadTask = async (props: uploadTaskProps) => {
    const { myself,
        taskContents,
        isDm,
        chatId,
        threadId,
        accessToken,
        setIsSubmitted,
        setTitleError,
        setTitleErrorOpen,
        setCurrentPreviewTaskId,
    } = props;

    if (taskContents.title === "") {
        setTitleError("Task title is required !!!")
        setTitleErrorOpen(true);
    } else {
        try {
            if (taskContents.project !== null) {
                const taskCreateResponse = await fetch(`${base_url}/task/create/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        team: myself.teamId,
                        project: taskContents.project.projectId,
                        assignee: taskContents.assignee.userId,
                        reporter: taskContents.reporter.userId,
                        title: taskContents.title,
                        priority: (taskContents.priority.priority !== "") ? taskContents.priority.priority : null,
                        effort_level: (taskContents.effortLevel.level !== "") ? taskContents.effortLevel.level : null,
                        status: (taskContents.status.status !== "") ? taskContents.status.status : null,
                        content: (taskContents.body.length !== 0) ? taskContents.body : [],
                        due_date: (taskContents.dueDate !== "") ? taskContents.dueDate : null,
                        github_url: (taskContents.githubLink.url !== "") ? taskContents.githubLink.url : null,
                        github_url_title: (taskContents.githubLink.title !== "") ? taskContents.githubLink.title : null,
                        general_url: (taskContents.generalLink.url !== "") ? taskContents.generalLink.url : null,
                        general_url_title: (taskContents.generalLink.title !== "") ? taskContents.generalLink.title : null,
                        tags: taskContents.tags,
                        chat_type: (isDm === null || isDm === undefined) ? null : (isDm ? "dm" : "gm"),
                        chat_id: chatId || null,
                        thread_id: threadId || null
                    }),
                });

                const taskCreateData = await taskCreateResponse.json();

                if (!taskCreateResponse.ok) {
                    throw new Error('Failed to create a task');
                } else {
                    setCurrentPreviewTaskId(taskCreateData.task_id)

                    for (const attachment of taskContents.attachments) {
                        const formData = new FormData()
                        formData.append("task", taskCreateData.task_id)
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
                        console.log("uploadAttachmentData:", uploadAttachmentData)

                        if (!uploadAttachmentResponse.ok) {
                            throw new Error(uploadAttachmentData.message || 'Attachment Upload Failed');
                        }
                    }

                    setIsSubmitted(true)
                }
            } else {
                console.error("taskContents.project is null:", taskContents.project)
            }

        } catch (error) {
            console.error(error);
            return [];
        }
    }

};