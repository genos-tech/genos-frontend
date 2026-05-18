import { getMessages } from "../../../i18n";
import { AttachmentFileProps } from "../../../types/tasks";

const base_url = import.meta.env.VITE_API_BASE_URL;

/**
 * POSTs each *new* attachment (one with a negative client-side
 * `attachment_id`) to `/task/attachment/` and returns the persisted rows
 * the backend produced.
 *
 * Used by both `sendUpdatedSpecificTask` (regular task save path) and the
 * milestone preview, so the two paths can't drift apart — the latter
 * needs to upload against the milestone's *backing* task id, not the
 * milestone id itself, which is why the function takes `taskId`
 * explicitly instead of pulling it off a `TaskProps`.
 *
 * Throws on the first non-2xx response so the caller can decide how to
 * surface the failure.
 */
export const uploadTaskAttachments = async (
    taskId: number,
    attachments: AttachmentFileProps[],
    accessToken: string | null
): Promise<any[]> => {
    const uploaded: any[] = [];
    for (const attachment of attachments) {
        if (attachment.attachment_id >= 0) continue;

        const formData = new FormData();
        formData.append("task", String(taskId));
        formData.append("attachment_id", "-1");
        formData.append("attached_file", attachment.file);
        formData.append("attached_type", attachment.file.type || "application/octet-stream");

        const res = await fetch(`${base_url}/task/attachment/`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data?.message || getMessages().tasks.errors.attachmentUploadFailed);
        }
        if (data) uploaded.push(data);
    }
    return uploaded;
};
