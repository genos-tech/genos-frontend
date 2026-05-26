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

        // Defensive: anything that lost its File reference along the
        // way (post-IDB round-trip, accidental shallow copy, etc.)
        // would 400 the backend with "attached_file: No file was
        // submitted." Skip and log it so we surface the symptom
        // without breaking the rest of the batch.
        // (Typed-as-File but post-save the runtime value can be a
        // string path, so we have to widen here.)
        const filePayload = attachment.file as unknown;
        if (!(filePayload instanceof Blob)) {
            console.error(
                "uploadTaskAttachments: skipping attachment without a File/Blob payload",
                { attachmentId: attachment.attachment_id, file: attachment.file }
            );
            continue;
        }

        // Always declare the multipart filename explicitly. Some
        // browsers (Safari notably) hand over a `File` whose `.name`
        // is empty for inputs that didn't carry a filename — and a
        // missing filename in the multipart part makes Django's
        // FileField validator return "No file was submitted." even
        // though bytes ARE present.
        const filename =
            attachment.name ||
            (filePayload instanceof File ? filePayload.name : "") ||
            `attachment-${Date.now()}`;
        const mime =
            attachment.type ||
            (filePayload instanceof File ? filePayload.type : "") ||
            "application/octet-stream";

        const formData = new FormData();
        formData.append("task", String(taskId));
        formData.append("attachment_id", "-1");
        formData.append("attached_file", filePayload, filename);
        formData.append("attached_type", mime);

        const res = await fetch(`${base_url}/task/attachment/`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
            // Surface the actual serializer/server error instead of the
            // generic fallback. Server returns `{ field: ["msg"] }` for
            // serializer failures, so stringify the whole payload to
            // make the cause visible in the console + thrown message.
            const detail =
                data == null
                    ? `HTTP ${res.status}`
                    : typeof data === "string"
                      ? data
                      : JSON.stringify(data);
            console.error("uploadTaskAttachments POST failed", {
                status: res.status,
                detail,
                filename,
                mime,
            });
            throw new Error(`${getMessages().tasks.errors.attachmentUploadFailed} (${detail})`);
        }
        if (data) uploaded.push(data);
    }
    return uploaded;
};
