import { Box, Stack } from "@mui/joy";

import { InboxHeader } from "./components/InboxHeader";
import { InboxSection } from "./components/InboxSection";
import { InboxSectionHeader } from "./components/InboxSectionHeader";
import { useInboxItems } from "./hooks/useInboxItems";
import { useInboxScroll } from "./hooks/useInboxScroll";
import { InboxHomeProps } from "./types/inboxTypes";

import { Sidebar } from "../../components/layout/sidebar";

export const InboxHome = (props: InboxHomeProps) => {
    const {
        currentTeam,
        setCurrentTeam,
        teamMemberProfiles,
        myself,
        socket,
        setMyself,
        openingService,
        setOpeningService,
        setCurrentMainChat,
        inboxItems,
        unReadInboxItemCount,
        unReadChatAndActivityCounts,
    } = props;

    const { activityInboxItems, requestInboxItems } = useInboxItems(inboxItems);
    const activityVirtuosoRef = useInboxScroll(activityInboxItems);
    const requestVirtuosoRef = useInboxScroll(requestInboxItems);

    return (
        <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
            <Sidebar
                currentTeam={currentTeam}
                myself={myself}
                openingService={openingService}
                setCurrentMainChat={setCurrentMainChat}
                setCurrentTeam={setCurrentTeam}
                setMyself={setMyself}
                setOpeningService={setOpeningService}
                socket={socket}
                teamMemberProfiles={teamMemberProfiles}
                unReadChatAndActivityCounts={unReadChatAndActivityCounts}
                unReadInboxItemCount={unReadInboxItemCount}
            />
            <Stack sx={{ width: "100%" }}>
                <InboxHeader />

                <Box sx={{ px: "50px" }}>
                    <Stack direction="row" sx={{ height: "3dvh" }}>
                        <InboxSectionHeader title="Activities" />
                        <InboxSectionHeader
                            title="Requests"
                            unreadCount={
                                unReadInboxItemCount > 0 ? unReadInboxItemCount : undefined
                            }
                        />
                    </Stack>

                    <Stack direction="row" sx={{ height: "93dvh" }}>
                        <InboxSection
                            ref={activityVirtuosoRef}
                            items={activityInboxItems}
                            myself={myself}
                            setMyself={setMyself}
                            setCurrentChat={setCurrentMainChat}
                            setOpeningService={setOpeningService}
                            socket={socket}
                            teamMemberProfiles={teamMemberProfiles}
                            itemKeyPrefix="inbox-general-items-bubble"
                        />
                        <InboxSection
                            ref={requestVirtuosoRef}
                            items={requestInboxItems}
                            myself={myself}
                            setMyself={setMyself}
                            setCurrentChat={setCurrentMainChat}
                            setOpeningService={setOpeningService}
                            socket={socket}
                            teamMemberProfiles={teamMemberProfiles}
                            itemKeyPrefix="inbox-request-bubble"
                        />
                    </Stack>
                </Box>
            </Stack>
        </Box>
    );
};
