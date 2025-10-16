import { ChatHome } from "../../features/chat/chatHome";
import { InboxHome } from "../../features/inbox/inboxHome";
import { NoteHome } from "../../features/notes/NoteHome";
import { TaskHome } from "../../features/tasks/taskHome";

interface AppContentProps {
    openingService: number;
    myself: any;
    setMyself: (myself: any) => void;
    setOpeningService: (service: number) => void;
    socketInstance: any;
    TEM: any;
    PM: any;
    TM: any;
    NM: any;
    CM: any;
    IM: any;
    UIM: any;
}

export const AppContent = ({
    openingService,
    myself,
    setMyself,
    setOpeningService,
    socketInstance,
    TEM,
    PM,
    TM,
    NM,
    CM,
    IM,
    UIM,
}: AppContentProps) => {
    if (openingService === 0) {
        return (
            <InboxHome
                currentTeam={TEM.currentTeam}
                inboxItems={IM.inboxItems}
                myself={myself}
                openingService={openingService}
                setCurrentMainChat={CM.setCurrentMainChat}
                setCurrentTeam={TEM.setCurrentTeam}
                setMyself={setMyself}
                setOpeningService={setOpeningService}
                socket={socketInstance}
                teamMemberProfiles={TEM.teamMemberProfiles}
                unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                unReadInboxItemCount={IM.unReadInboxItemCount}
            />
        );
    }

    if (openingService === 1) {
        return (
            <ChatHome
                CM={CM}
                myself={myself}
                NM={NM}
                openingService={openingService}
                PM={PM}
                setMyself={setMyself}
                setOpeningService={setOpeningService}
                socket={socketInstance}
                TEM={TEM}
                TM={TM}
                unReadInboxItemCount={IM.unReadInboxItemCount}
            />
        );
    }

    if (openingService === 2) {
        return (
            <TaskHome
                allChats={CM.allChats}
                funcSetAllChats={CM.funcSetAllChats}
                moveToSpecificChat={CM.moveToSpecificChat}
                myself={myself}
                NM={NM}
                openingService={openingService}
                PM={PM}
                setAllChats={CM.setAllChats}
                setCurrentMainChat={CM.setCurrentMainChat}
                setMyself={setMyself}
                setOpeningService={setOpeningService}
                socket={socketInstance}
                TEM={TEM}
                TM={TM}
                unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                unReadInboxItemCount={IM.unReadInboxItemCount}
            />
        );
    }

    if (openingService === 3) {
        return (
            <NoteHome
                CM={CM}
                myself={myself}
                NM={NM}
                openingService={openingService}
                PM={PM}
                setMyself={setMyself}
                setOpeningService={setOpeningService}
                socket={socketInstance}
                TEM={TEM}
                TM={TM}
                unReadInboxItemCount={IM.unReadInboxItemCount}
            />
        );
    }

    return null;
};
