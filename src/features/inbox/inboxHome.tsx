import { useEffect, useRef, useState } from "react";
import AllInboxIcon from "@mui/icons-material/AllInbox";
import { Badge, Box, Card, Chip, List, Stack, Typography } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { InboxBubble } from "./components/InboxBubble";
import { useScrollToBottomOnNewItem } from "./hooks/inboxHooks";

import { Sidebar } from "../../components/layout/sidebar";
import { Team, UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import { InboxItemProps } from "../../types/common";

type InboxHomeProps = {
    currentTeam: Team;
    setCurrentTeam: (value: Team) => void;
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    socket: Socket | null;
    setMyself: (me: UserProps) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    inboxItems: InboxItemProps[];
    unReadInboxItemCount: number;
    unReadChatAndActivityCounts: number;
};

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
    const boxRef = useRef<HTMLDivElement>(null);

    const [activityInboxItems, setActivityInboxItems] = useState<InboxItemProps[]>([]);
    const [requestInboxItems, setRequestInboxItems] = useState<InboxItemProps[]>([]);

    useEffect(() => {
        const box = boxRef.current;
        if (box) {
            box.scrollTop = box.scrollHeight;
        }
        setActivityInboxItems(inboxItems.filter((item) => item.itemType === 0));
        setRequestInboxItems(inboxItems.filter((item) => item.itemType !== 0));
    }, [inboxItems]);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    useScrollToBottomOnNewItem(virtuosoRef as React.RefObject<VirtuosoHandle>, inboxItems);

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
                <Card
                    className="Sidebar-overlay"
                    variant="soft"
                    sx={{
                        height: "50px",
                        justifyContent: "center",
                        borderRadius: "0",
                    }}
                >
                    <Typography level="h4" startDecorator={<AllInboxIcon />}>
                        Inbox
                    </Typography>
                </Card>

                <Box sx={{ px: "50px" }}>
                    <Stack direction="row" sx={{ height: "3dvh" }}>
                        <Box
                            sx={{
                                width: "50%",
                                display: "flex", // make it a flex container
                                justifyContent: "center", // horizontal center
                                alignItems: "center", // vertical center
                            }}
                        >
                            <Typography level="h4" sx={{ mt: "10px" }}>
                                Activities
                            </Typography>
                        </Box>

                        <Box
                            sx={{
                                width: "50%",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            {unReadInboxItemCount > 0 && (
                                <>
                                    <Typography level="h4">Requests</Typography>
                                    <Chip
                                        color="primary"
                                        size="sm"
                                        sx={{ ml: "5px" }}
                                        variant="solid"
                                    >
                                        {unReadInboxItemCount}
                                    </Chip>
                                </>
                            )}
                            {unReadInboxItemCount < 1 && (
                                <Typography level="h4" sx={{ mt: "10px" }}>
                                    Requests
                                </Typography>
                            )}
                        </Box>
                    </Stack>

                    <Stack direction={"row"} sx={{ height: "93dvh" }}>
                        {/* General Items */}
                        <List
                            className="custom-scrollbar"
                            size="sm"
                            sx={{
                                "--ListItem-paddingY": "0.3rem",
                                "--ListItem-paddingX": "1rem",
                                overflowY: "auto",
                                overflowX: "hidden",
                            }}
                        >
                            <Virtuoso
                                ref={virtuosoRef}
                                atBottomThreshold={128}
                                atTopThreshold={64}
                                className="custom-scrollbar"
                                initialTopMostItemIndex={0}
                                style={{ height: "100%" }}
                                totalCount={activityInboxItems.length}
                                itemContent={(index) => {
                                    const item = activityInboxItems[index];
                                    return (
                                        <InboxBubble
                                            key={`inbox-general-items-bubble-${item.itemId}`}
                                            inboxItem={item}
                                            myself={myself}
                                            setCurrentChat={setCurrentMainChat}
                                            setMyself={setMyself}
                                            setOpeningService={setOpeningService}
                                            socket={socket}
                                            teamMemberProfiles={teamMemberProfiles}
                                        />
                                    );
                                }}
                            />
                        </List>

                        {/* Request Items */}
                        <List
                            className="custom-scrollbar"
                            size="sm"
                            sx={{
                                "--ListItem-paddingY": "0.3rem",
                                "--ListItem-paddingX": "1rem",
                                overflowY: "auto",
                                overflowX: "hidden",
                            }}
                        >
                            <Virtuoso
                                ref={virtuosoRef}
                                atBottomThreshold={128}
                                atTopThreshold={64}
                                className="custom-scrollbar"
                                initialTopMostItemIndex={0}
                                style={{ height: "100%" }}
                                totalCount={requestInboxItems.length}
                                itemContent={(index) => {
                                    const item = requestInboxItems[index];
                                    return (
                                        <InboxBubble
                                            key={`inbox-request-bubble-${item.itemId}`}
                                            inboxItem={item}
                                            myself={myself}
                                            setCurrentChat={setCurrentMainChat}
                                            setMyself={setMyself}
                                            setOpeningService={setOpeningService}
                                            socket={socket}
                                            teamMemberProfiles={teamMemberProfiles}
                                        />
                                    );
                                }}
                            />
                        </List>
                    </Stack>
                </Box>
            </Stack>
        </Box>
    );
};
