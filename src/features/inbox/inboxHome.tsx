import { useState, useEffect, useRef } from "react";
import { Box, List, Card, Stack, Typography, Badge, Chip } from "@mui/joy";
import { Socket } from "socket.io-client";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { useScrollToBottomOnNewItem } from "./hooks/inboxHooks";
import { InboxItemProps } from "../../types/common";
import { Team, UserProps } from "../../types/admin";
import { Sidebar } from "../../components/layout/sidebar";
import { InboxBubble } from "./components/InboxBubble";
import { ChatProps } from "../../types/chat";

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
        setRequestInboxItems(
            inboxItems.filter((item) => item.itemType === 1 || item.itemType === 2)
        );
    }, [inboxItems]);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    useScrollToBottomOnNewItem(virtuosoRef as React.RefObject<VirtuosoHandle>, inboxItems);

    return (
        <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
            <Sidebar
                currentTeam={currentTeam}
                setCurrentTeam={setCurrentTeam}
                teamMemberProfiles={teamMemberProfiles}
                socket={socket}
                myself={myself}
                setMyself={setMyself}
                openingService={openingService}
                setOpeningService={setOpeningService}
                setCurrentMainChat={setCurrentMainChat}
                unReadInboxItemCount={unReadInboxItemCount}
                unReadChatAndActivityCounts={unReadChatAndActivityCounts}
            />
            <Stack sx={{ width: "100%" }}>
                <Card
                    className="Sidebar-overlay"
                    sx={{
                        height: "50px",
                        justifyContent: "center",
                        borderRadius: "0",
                    }}
                    variant="soft"
                >
                    <Typography level="h4">Inbox</Typography>
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
                                        variant="solid"
                                        color="primary"
                                        size="sm"
                                        sx={{ ml: "5px" }}
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
                            size="sm"
                            sx={{
                                "--ListItem-paddingY": "0.3rem",
                                "--ListItem-paddingX": "1rem",
                                overflowY: "auto",
                                overflowX: "hidden",
                            }}
                            className="custom-scrollbar"
                        >
                            <Virtuoso
                                ref={virtuosoRef}
                                className="custom-scrollbar"
                                style={{ height: "100%" }}
                                totalCount={activityInboxItems.length}
                                initialTopMostItemIndex={0}
                                atTopThreshold={64}
                                atBottomThreshold={128}
                                itemContent={(index) => {
                                    const item = activityInboxItems[index];
                                    return (
                                        <InboxBubble
                                            key={`inbox-general-items-bubble-${item.itemId}`}
                                            teamMemberProfiles={teamMemberProfiles}
                                            socket={socket}
                                            myself={myself}
                                            setMyself={setMyself}
                                            inboxItem={item}
                                            setCurrentChat={setCurrentMainChat}
                                            setOpeningService={setOpeningService}
                                        />
                                    );
                                }}
                            />
                        </List>

                        {/* Request Items */}
                        <List
                            size="sm"
                            sx={{
                                "--ListItem-paddingY": "0.3rem",
                                "--ListItem-paddingX": "1rem",
                                overflowY: "auto",
                                overflowX: "hidden",
                            }}
                            className="custom-scrollbar"
                        >
                            <Virtuoso
                                ref={virtuosoRef}
                                className="custom-scrollbar"
                                style={{ height: "100%" }}
                                totalCount={requestInboxItems.length}
                                initialTopMostItemIndex={0}
                                atTopThreshold={64}
                                atBottomThreshold={128}
                                itemContent={(index) => {
                                    const item = requestInboxItems[index];
                                    return (
                                        <InboxBubble
                                            key={`inbox-request-bubble-${item.itemId}`}
                                            teamMemberProfiles={teamMemberProfiles}
                                            socket={socket}
                                            setMyself={setMyself}
                                            myself={myself}
                                            inboxItem={item}
                                            setCurrentChat={setCurrentMainChat}
                                            setOpeningService={setOpeningService}
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
