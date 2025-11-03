import { ChatHome } from "../../features/chat/chatHome";
import { InboxHome } from "../../features/inbox/inboxHome";
import { NoteHome } from "../../features/notes/NoteHome";
import { TaskHome } from "../../features/tasks/taskHome";

interface AppContentProps {
    myself: any;
    setMyself: (myself: any) => void;
    socketInstance: any;
    CM: any;
    IM: any;
    NM: any;
    PM: any;
    TEM: any;
    TM: any;
    UIM: any;
}

export const AppContent = ({
    myself,
    setMyself,
    socketInstance,
    CM,
    IM,
    NM,
    PM,
    TEM,
    TM,
    UIM,
}: AppContentProps) => {
    if (UIM.openingService === 0) {
        return (
            <InboxHome
                CM={CM}
                IM={IM}
                myself={myself}
                setMyself={setMyself}
                socket={socketInstance}
                TEM={TEM}
                UIM={UIM}
            />
        );
    }

    if (UIM.openingService === 1) {
        return (
            <ChatHome
                CM={CM}
                IM={IM}
                myself={myself}
                NM={NM}
                PM={PM}
                setMyself={setMyself}
                socket={socketInstance}
                TEM={TEM}
                TM={TM}
                UIM={UIM}
            />
        );
    }

    if (UIM.openingService === 2) {
        return (
            <TaskHome
                CM={CM}
                IM={IM}
                myself={myself}
                NM={NM}
                PM={PM}
                setMyself={setMyself}
                socket={socketInstance}
                TEM={TEM}
                TM={TM}
                UIM={UIM}
            />
        );
    }

    if (UIM.openingService === 3) {
        return (
            <NoteHome
                CM={CM}
                IM={IM}
                myself={myself}
                NM={NM}
                PM={PM}
                setMyself={setMyself}
                socket={socketInstance}
                TEM={TEM}
                TM={TM}
                UIM={UIM}
            />
        );
    }

    return null;
};
