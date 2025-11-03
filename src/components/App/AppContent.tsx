import { ChatHome } from "../../features/chat/chatHome";
import { InboxHome } from "../../features/inbox/inboxHome";
import { NoteHome } from "../../features/notes/NoteHome";
import { TaskHome } from "../../features/tasks/taskHome";

interface AppContentProps {
    myself: any;
    setMyself: (myself: any) => void;
    socketInstance: any;
    useCM: any;
    useIM: any;
    useNM: any;
    usePM: any;
    useTEM: any;
    useTM: any;
    useUISM: any;
}

export const AppContent = ({
    myself,
    setMyself,
    socketInstance,
    useCM,
    useIM,
    useNM,
    usePM,
    useTEM,
    useTM,
    useUISM,
}: AppContentProps) => {
    if (useUISM.openingService === 0) {
        return (
            <InboxHome
                useCM={useCM}
                useIM={useIM}
                myself={myself}
                setMyself={setMyself}
                socket={socketInstance}
                useTEM={useTEM}
                useUISM={useUISM}
            />
        );
    }

    if (useUISM.openingService === 1) {
        return (
            <ChatHome
                useCM={useCM}
                useIM={useIM}
                myself={myself}
                useNM={useNM}
                usePM={usePM}
                setMyself={setMyself}
                socket={socketInstance}
                useTEM={useTEM}
                useTM={useTM}
                useUISM={useUISM}
            />
        );
    }

    if (useUISM.openingService === 2) {
        return (
            <TaskHome
                useCM={useCM}
                useIM={useIM}
                myself={myself}
                useNM={useNM}
                usePM={usePM}
                setMyself={setMyself}
                socket={socketInstance}
                useTEM={useTEM}
                useTM={useTM}
                useUISM={useUISM}
            />
        );
    }

    if (useUISM.openingService === 3) {
        return (
            <NoteHome
                useCM={useCM}
                useIM={useIM}
                myself={myself}
                useNM={useNM}
                usePM={usePM}
                setMyself={setMyself}
                socket={socketInstance}
                useTEM={useTEM}
                useTM={useTM}
                useUISM={useUISM}
            />
        );
    }

    return null;
};
