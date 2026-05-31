import { useMemo, useState } from "react";

import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../types/chat";

interface UseMessageManagementProps {
    chat: ChatProps | ThreadProps;
    isThread?: boolean;
}

export const useMessageManagement = ({ chat, isThread = false }: UseMessageManagementProps) => {
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetMessage, setEditTargetMessage] = useState<
        MessageProps | ThreadMessageProps
    >();
    const [numEditorLines, setNumEditorLines] = useState<number>(1);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [errorOpen, setErrorOpen] = useState(false);

    // Render every message, including the first. The DM-only `slice(1)`
    // that used to live here dropped the legacy backend's auto-generated
    // genesis stub (a "<chat> created." system message it injected as the
    // first row of every DM). The v3 chat API no longer ships that stub
    // (see `useChatManagement.funcSetAllChats`), so slicing now silently
    // hides the first REAL message — most visibly the self-DM's opening
    // "Welcome…" note and a DM's first line. Other kinds (GM/MDM/PM) were
    // never sliced, so this only changes DM. System messages, where they
    // still exist, are filtered by `sender.isSystemUser`, not by sequence.
    const messages = chat.messages;

    const indexMap = useMemo(() => {
        const messageIdKey = isThread ? "messageIdWithChatIdAndThreadId" : "messageIdWithChatId";
        return Object.fromEntries(
            messages.map((message, idx) => [(message as any)[messageIdKey], idx])
        );
    }, [messages, isThread]);

    const resetEditState = () => {
        setIsInEdit(false);
        setEditTargetMessage(undefined);
    };

    return {
        messages,
        isInEdit,
        setIsInEdit,
        editTargetMessage,
        setEditTargetMessage,
        numEditorLines,
        setNumEditorLines,
        indexMap,
        errorMessage,
        setErrorMessage,
        errorOpen,
        setErrorOpen,
        resetEditState,
    };
};
