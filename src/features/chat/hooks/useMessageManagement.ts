import { useEffect, useState } from "react";

import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../types/chat";

interface UseMessageManagementProps {
    chat: ChatProps | ThreadProps;
    isThread?: boolean;
}

export const useMessageManagement = ({ chat, isThread = false }: UseMessageManagementProps) => {
    const [messages, setMessages] = useState(chat.messages);
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetMessage, setEditTargetMessage] = useState<
        MessageProps | ThreadMessageProps
    >();
    const [numEditorLines, setNumEditorLines] = useState<number>(1);
    const [indexMap, setIndexMap] = useState<{ [k: string]: any }>();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [errorOpen, setErrorOpen] = useState(false);

    useEffect(() => {
        // For DM chat, remove the first message because it is the "has joined" message.
        if (chat.chatType === 1) {
            setMessages(chat.messages.slice(1));
        } else {
            setMessages(chat.messages);
        }
    }, [chat.messages]);

    useEffect(() => {
        const messageIdKey = isThread ? "messageIdWithChatIdAndThreadId" : "messageIdWithChatId";
        setIndexMap(
            Object.fromEntries(
                messages.map((message, idx) => [(message as any)[messageIdKey], idx])
            )
        );
    }, [messages, isThread]);

    const resetEditState = () => {
        setIsInEdit(false);
        setEditTargetMessage(undefined);
    };

    return {
        messages,
        setMessages,
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
