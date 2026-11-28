/**
 * The comment a modal-hosted task preview was opened on (MIP-1755). On a task page the comment is
 * named by the URL (`/task/:taskId/comment/:commentId`); a preview modal leaves the URL on the
 * page behind it, so its link's comment travels here instead. Null outside a modal.
 */
import { createContext } from "react";

export type ModalCommentFocus = { taskId: number; commentId: number | undefined };

export const ModalCommentFocusContext = createContext<ModalCommentFocus | null>(null);
