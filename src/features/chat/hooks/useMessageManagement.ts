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

    const messages = useMemo(() => {
        if (chat.chatType === 1 && isThread === false) {
            return chat.messages.slice(1);
        }
        return chat.messages;
    }, [chat.messages, chat.chatType, isThread]);

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
