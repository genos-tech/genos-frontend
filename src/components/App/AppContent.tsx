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
                TEM={TEM}
                IM={IM}
                myself={myself}
                CM={CM}
                setMyself={setMyself}
                socket={socketInstance}
                UIM={UIM}
            />
        );
    }

    if (UIM.openingService === 1) {
        return (
            <ChatHome
                CM={CM}
                myself={myself}
                NM={NM}
                PM={PM}
                setMyself={setMyself}
                socket={socketInstance}
                TEM={TEM}
                TM={TM}
                IM={IM}
                UIM={UIM}
            />
        );
    }

    if (UIM.openingService === 2) {
        return (
            <TaskHome
                allChats={CM.allChats}
                funcSetAllChats={CM.funcSetAllChats}
                moveToSpecificChat={CM.moveToSpecificChat}
                myself={myself}
                NM={NM}
                PM={PM}
                setAllChats={CM.setAllChats}
                setCurrentMainChat={CM.setCurrentMainChat}
                setMyself={setMyself}
                socket={socketInstance}
                TEM={TEM}
                TM={TM}
                unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                IM={IM}
                UIM={UIM}
            />
        );
    }

    if (UIM.openingService === 3) {
        return (
            <NoteHome
                CM={CM}
                myself={myself}
                NM={NM}
                PM={PM}
                setMyself={setMyself}
                socket={socketInstance}
                TEM={TEM}
                TM={TM}
                IM={IM}
                UIM={UIM}
            />
        );
    }

    return null;
};
