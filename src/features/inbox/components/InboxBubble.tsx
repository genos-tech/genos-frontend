import { useRef, useState } from "react";
import { Box, Button, Card, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../components/blockNote/bnChatPreview";
import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { InboxItemProps } from "../../../types/common";
import { extractYYYYMMDDHHMM } from "../../../utils/dateUtils";

const requestNameLookUp: { [key: number]: string } = {
    1: "team",
    2: "project",
};
export const getItemBody = (requestType: number, targetName: UserProps) => [
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            {
                text: `Request has been approved to join the ${requestNameLookUp[requestType]}: `,
                type: "text",
                styles: {},
            },
            {
                text: targetName,
                type: "text",
                styles: { bold: true, textColor: "pink" },
            },
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
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    inboxItem: InboxItemProps;
    setOpeningService: (service: number) => void;
    setCurrentChat: (chat: ChatProps) => void;
};
export const InboxBubble = (props: InboxBubbleProps) => {
    const {
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        inboxItem,
        setOpeningService,
        setCurrentChat,
    } = props;
    const { mode } = useColorScheme();
    const boxRef = useRef<HTMLDivElement>(null);
    const [requestApproved, setRequestApproved] = useState<boolean>(false);

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
                                    borderRadius: "5px",
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
                                    borderRadius: "5px",
                                    fontWeight: "bold",
                                }}
                                size="md"
                            >
                                Project Request
                            </Chip>
                        )}
                        {inboxItem.itemType === 3 && (
                            <Chip
                                key={`inbox-bubble-chip-${inboxItem.itemId}-${inboxItem.tsSent}`}
                                variant="soft"
                                color="neutral"
                                sx={{
                                    marginRight: "auto",
                                    borderRadius: "5px",
                                    fontWeight: "bold",
                                }}
                                size="md"
                            >
                                GM Request
                            </Chip>
                        )}

                        <Typography level="body-xs" fontWeight="bold">
                            {extractYYYYMMDDHHMM(inboxItem.tsSent)}
                        </Typography>
                    </Stack>

                    {inboxItem.itemBody[0].content.length > 0 && (
                        <BnChatPreview
                            customClassName="inbox-preview"
                            teamMemberProfiles={teamMemberProfiles}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            key={`${inboxItem.itemType}-${inboxItem.itemId}-${inboxItem.tsSent}`}
                            content={inboxItem.itemBody}
                            isSent={true}
                            setCurrentChat={setCurrentChat}
                            setOpeningService={setOpeningService}
                        />
                    )}

                    {(inboxItem.itemType === 1 ||
                        inboxItem.itemType === 2 ||
                        inboxItem.itemType === 3) &&
                        (inboxItem.isRead === true || requestApproved === true) && (
                            <Button
                                key={`inbox-approved-button-${inboxItem.itemType}-${inboxItem.itemId}`}
                                variant="outlined"
                                color="neutral"
                                size="sm"
                                sx={{ width: "100px", alignSelf: "flex-end" }}
                                disabled={true}
                            >
                                Approved
                            </Button>
                        )}
                    {(inboxItem.itemType === 1 ||
                        inboxItem.itemType === 2 ||
                        inboxItem.itemType === 3) &&
                        inboxItem.isRead === false &&
                        requestApproved === false && (
                            <Button
                                key={`inbox-approve-button-${inboxItem.itemType}-${inboxItem.itemId}`}
                                variant="soft"
                                size="sm"
                                sx={{ width: "100px", alignSelf: "flex-end" }}
                                onClick={() => {
                                    if (socket && inboxItem.itemType === 1) {
                                        socket.emit("approve_join_team_request", {
                                            item_id: inboxItem.itemId,
                                        });
                                    }
                                    if (socket && inboxItem.itemType === 2) {
                                        socket.emit("approve_join_project_request", {
                                            item_id: inboxItem.itemId,
                                        });
                                    }
                                    if (socket && inboxItem.itemType === 3) {
                                        socket.emit("approve_join_gm_request", {
                                            item_id: inboxItem.itemId,
                                        });
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
