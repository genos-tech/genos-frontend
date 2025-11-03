import { Box, Stack } from "@mui/joy";

import { Sidebar } from "../../components/layout/sidebar";
import { InboxHeader } from "./components/InboxHeader";
import { InboxSection } from "./components/InboxSection";
import { InboxSectionHeader } from "./components/InboxSectionHeader";
import { useInboxItems } from "./hooks/useInboxItems";
import { useInboxScroll } from "./hooks/useInboxScroll";
import { InboxHomeProps } from "./types/inboxTypes";

export const InboxHome = (props: InboxHomeProps) => {
    const { TEM, IM, myself, socket, setMyself, CM, UIM } = props;

    const { activityInboxItems, requestInboxItems } = useInboxItems(IM.inboxItems);
    const activityVirtuosoRef = useInboxScroll(activityInboxItems);
    const requestVirtuosoRef = useInboxScroll(requestInboxItems);

    return (
        <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
            <Sidebar
                CM={CM}
                IM={IM}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                TEM={TEM}
                UIM={UIM}
            />
            <Stack sx={{ width: "100%" }}>
                <InboxHeader />

                <Box sx={{ px: "50px" }}>
                    <Stack direction="row" sx={{ height: "3dvh" }}>
                        <InboxSectionHeader title="Activities" />
                        <InboxSectionHeader
                            title="Requests"
                            unreadCount={
                                IM.unReadInboxItemCount > 0 ? IM.unReadInboxItemCount : undefined
                            }
                        />
                    </Stack>

                    <Stack direction="row" sx={{ height: "93dvh" }}>
                        <InboxSection
                            ref={activityVirtuosoRef}
                            CM={CM}
                            itemKeyPrefix="inbox-general-items-bubble"
                            items={activityInboxItems}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            TEM={TEM}
                            UIM={UIM}
                        />
                        <InboxSection
                            ref={requestVirtuosoRef}
                            CM={CM}
                            itemKeyPrefix="inbox-request-bubble"
                            items={requestInboxItems}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            TEM={TEM}
                            UIM={UIM}
                        />
                    </Stack>
                </Box>
            </Stack>
        </Box>
    );
};
