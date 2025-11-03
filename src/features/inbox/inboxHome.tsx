import { Box, Stack } from "@mui/joy";

import { InboxHeader } from "./components/InboxHeader";
import { InboxSection } from "./components/InboxSection";
import { InboxSectionHeader } from "./components/InboxSectionHeader";
import { useInboxItems } from "./hooks/useInboxItems";
import { useInboxScroll } from "./hooks/useInboxScroll";
import { InboxHomeProps } from "./types/inboxTypes";

import { Sidebar } from "../../components/layout/sidebar";

export const InboxHome = (props: InboxHomeProps) => {
    const { useTEM, useIM, myself, socket, setMyself, useCM, useUISM } = props;

    const { activityInboxItems, requestInboxItems } = useInboxItems(useIM.inboxItems);
    const activityVirtuosoRef = useInboxScroll(activityInboxItems);
    const requestVirtuosoRef = useInboxScroll(requestInboxItems);

    return (
        <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
            <Sidebar
                useCM={useCM}
                useIM={useIM}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useTEM={useTEM}
                useUISM={useUISM}
            />
            <Stack sx={{ width: "100%" }}>
                <InboxHeader />

                <Box sx={{ px: "50px" }}>
                    <Stack direction="row" sx={{ height: "3dvh" }}>
                        <InboxSectionHeader title="Activities" />
                        <InboxSectionHeader
                            title="Requests"
                            unreadCount={
                                useIM.unReadInboxItemCount > 0
                                    ? useIM.unReadInboxItemCount
                                    : undefined
                            }
                        />
                    </Stack>

                    <Stack direction="row" sx={{ height: "93dvh" }}>
                        <InboxSection
                            ref={activityVirtuosoRef}
                            useCM={useCM}
                            itemKeyPrefix="inbox-general-items-bubble"
                            items={activityInboxItems}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                        <InboxSection
                            ref={requestVirtuosoRef}
                            useCM={useCM}
                            itemKeyPrefix="inbox-request-bubble"
                            items={requestInboxItems}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Stack>
                </Box>
            </Stack>
        </Box>
    );
};
