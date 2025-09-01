import { Socket } from "socket.io-client";
import { useEffect, useState, useRef } from "react";
import { Box, Chip, Typography, Card, Button, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { UserProps } from "../../../types/admin";
import { InboxProps } from "../../../types/common";
import { extractMMDDHHMM } from "../../../utils/dateUtils";
import { useAuth } from "../../../context/AuthContext";
import { BnChatPreview } from "../../../components/blockNote/bnChatPreview";
import { ChatProps } from "../../../types/chat";

const base_url = import.meta.env.VITE_API_BASE_URL;

const item_body = [
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            { text: "Your request to join the team has been approved.", type: "text", styles: {} },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [],
        children: [],
    },
];

type InboxBubbleProps = {
    socket: Socket | null;
    myself: UserProps;
    inboxItem: InboxProps;
    setOpeningService: (service: number) => void;
    setCurrentChat: (chat: ChatProps) => void;
};
export const InboxBubble = (props: InboxBubbleProps) => {
    const { socket, myself, inboxItem, setOpeningService, setCurrentChat } = props;
    const { mode } = useColorScheme();
    const boxRef = useRef<HTMLDivElement>(null);
    const { accessToken } = useAuth();
    const [requestApproved, setRequestApproved] = useState<boolean>(false);

    async function approveTeamJoin(itemId: number): Promise<void> {
        try {
            const approveTeamJoinResponse = await fetch(`${base_url}/team/join/fromInbox/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    team_id: myself.teamId,
                    item_id: itemId,
                }),
            });

            const approveTeamJoinData = await approveTeamJoinResponse.json();

            if (!approveTeamJoinResponse.ok) {
                throw new Error("Project Creation Failed");
            } else {
                const sendInboxMessageResponse = await fetch(`${base_url}/inbox/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                        team_id: myself.teamId,
                        sender_id: myself.userId,
                        receiver_id: approveTeamJoinData.attendee,
                        item_body: item_body,
                        item_type: 0,
                    }),
                });

                if (!sendInboxMessageResponse.ok) {
                    throw new Error("Failed to send approved message");
                } else {
                    const updateInboxItemResponse = await fetch(`${base_url}/inbox/`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({
                            team_id: myself.teamId,
                            item_id: itemId,
                            is_read: true,
                        }),
                    });

                    if (!updateInboxItemResponse.ok) {
                        throw new Error("Failed to update inbox item");
                    }
                }
            }
        } catch (error) {
            const err_msg = `${error}`;
            console.error(err_msg);
        }
    }

    async function approveProjectJoin(itemId: number): Promise<void> {
        try {
            const approveTeamJoinResponse = await fetch(`${base_url}/project/join/fromInbox/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    team_id: myself.teamId,
                    item_id: itemId,
                }),
            });

            const approveTeamJoinData = await approveTeamJoinResponse.json();

            if (!approveTeamJoinResponse.ok) {
                throw new Error("Project Creation Failed");
            } else {
                const sendInboxMessageResponse = await fetch(`${base_url}/inbox/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                        team_id: myself.teamId,
                        sender_id: myself.userId,
                        receiver_id: approveTeamJoinData.attendee,
                        item_body: item_body,
                        item_type: 0,
                    }),
                });

                if (!sendInboxMessageResponse.ok) {
                    throw new Error("Failed to send approved message");
                } else {
                    const updateInboxItemResponse = await fetch(`${base_url}/inbox/`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({
                            team_id: myself.teamId,
                            item_id: itemId,
                            is_read: true,
                        }),
                    });

                    if (!updateInboxItemResponse.ok) {
                        throw new Error("Failed to update inbox item");
                    }
                }
            }
        } catch (error) {
            const err_msg = `${error}`;
            console.error(err_msg);
        }
    }

    console.log("inboxItem.itemBody:", inboxItem.itemBody);

    return (
        <Box
            ref={boxRef}
            sx={{
                py: 0.5,
                px: 3,
                height: "100%",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <Box key={`inbox-bubble-box-${inboxItem.itemId}-${inboxItem.tsSent}`}>
                <Card
                    variant="outlined"
                    sx={{
                        backgroundColor: mode === "dark" ? "black" : "white",
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <Stack direction="row" alignItems="center">
                        {inboxItem.itemType === 1 && (
                            <Chip
                                key={`inbox-bubble-chip-${inboxItem.itemId}-${inboxItem.tsSent}`}
                                variant="soft"
                                color="neutral"
                                sx={{
                                    marginRight: "auto",
                                    borderRadius: "7px",
                                    fontWeight: "bold",
                                }}
                                size="md"
                            >
                                Team Request
                            </Chip>
                        )}
                        {inboxItem.itemType === 2 && (
                            <Chip
                                key={`inbox-bubble-chip-${inboxItem.itemId}-${inboxItem.tsSent}`}
                                variant="soft"
                                color="neutral"
                                sx={{
                                    marginRight: "auto",
                                    borderRadius: "7px",
                                    fontWeight: "bold",
                                }}
                                size="md"
                            >
                                Project Request
                            </Chip>
                        )}

                        <Typography level="body-xs" fontWeight="bold">
                            {extractMMDDHHMM(inboxItem.tsSent)}
                        </Typography>
                    </Stack>

                    {inboxItem.itemBody[0].content.length > 0 && (
                        <BnChatPreview
                            customClassName="inbox-preview"
                            myself={myself}
                            socket={socket}
                            key={`${inboxItem.itemType}-${inboxItem.itemId}-${inboxItem.tsSent}`}
                            content={inboxItem.itemBody}
                            isSent={true}
                            setCurrentChat={setCurrentChat}
                            setOpeningService={setOpeningService}
                        />
                    )}

                    {(inboxItem.itemType === 1 || inboxItem.itemType === 2) &&
                        (inboxItem.isRead === true || requestApproved === true) && (
                            <Button
                                variant="outlined"
                                color="neutral"
                                size="sm"
                                sx={{ width: "100px", alignSelf: "flex-end" }}
                                disabled={true}
                            >
                                Approved
                            </Button>
                        )}
                    {(inboxItem.itemType === 1 || inboxItem.itemType === 2) &&
                        inboxItem.isRead === false &&
                        requestApproved === false && (
                            <Button
                                variant="soft"
                                size="sm"
                                sx={{ width: "100px", alignSelf: "flex-end" }}
                                onClick={() => {
                                    if (inboxItem.itemType === 1) {
                                        approveTeamJoin(inboxItem.itemId);
                                    }
                                    if (inboxItem.itemType === 2) {
                                        approveProjectJoin(inboxItem.itemId);
                                    }
                                    setRequestApproved(true);
                                }}
                            >
                                Approve
                            </Button>
                        )}
                </Card>
            </Box>
        </Box>
    );
};
