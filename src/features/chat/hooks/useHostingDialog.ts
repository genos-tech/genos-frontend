import { useNoteModalHostZIndex } from "../../../components/modals/noteModalHostZIndex";
import { useUrlLinkModal } from "../../../hooks/common/UrlLinkModalContext";

/**
 * For a chat drawn inside the link-preview dialog, `null` elsewhere (MIP-2580). What would move
 * the page behind (open a thread or a task, focus a message) opens in the dialog instead.
 */
export const useHostingDialog = () => {
    const isHosted = useNoteModalHostZIndex() != null;
    const urlLinkModal = useUrlLinkModal();
    if (!isHosted) return null;
    return {
        openThread: (typePath: string, chatId: string, rootMessageId: string) => {
            urlLinkModal?.openModalByHref(
                `/workspace/chat/${typePath}/${chatId}/thread/${rootMessageId}`
            );
        },
        openTask: (projectId: number | undefined, taskId: number | null | undefined) => {
            if (!projectId || !taskId || taskId <= 0) return;
            urlLinkModal?.openModalByHref(`/workspace/tasks/project/${projectId}/task/${taskId}`);
        },
    };
};
