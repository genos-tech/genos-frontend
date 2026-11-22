import { ChatContext, ChatProviderProps } from "./chatContextState";

export const ChatProvider = ({
    children,
    socket,
    myself,
    setMyself,
    useUISM,
    useCM,
    usePM,
    useTEM,
    useNM,
    useTM,
    currentThreadTaskId,
    setCurrentThreadTaskId,
}: ChatProviderProps) => {
    return (
        <ChatContext.Provider
            value={{
                socket,
                myself,
                setMyself,
                useUISM,
                useCM,
                usePM,
                useTEM,
                useNM,
                useTM,
                currentThreadTaskId,
                setCurrentThreadTaskId,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
};
