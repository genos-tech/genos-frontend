import { useRef, useState } from "react";
import { Box, Button, Card, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../components/blockNote/bnChatPreview";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../types/admin";
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
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    inboxItem: InboxItemProps;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
};
export const InboxBubble = (props: InboxBubbleProps) => {
    const { useTEM, socket, myself, setMyself, inboxItem, useUISM, useCM } = props;
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
                    <Stack alignItems="center" direction="row">
                        {inboxItem.itemType === 1 && (
                            <Chip
                                key={`inbox-bubble-chip-${inboxItem.itemId}-${inboxItem.tsSent}`}
                                color="neutral"
                                size="md"
                                variant="soft"
                                sx={{
                                    marginRight: "auto",
                                    borderRadius: "5px",
                                    fontWeight: "bold",
                                }}
                            >
                                Team Request
                            </Chip>
                        )}
                        {inboxItem.itemType === 2 && (
                            <Chip
                                key={`inbox-bubble-chip-${inboxItem.itemId}-${inboxItem.tsSent}`}
                                color="neutral"
                                size="md"
                                variant="soft"
                                sx={{
                                    marginRight: "auto",
                                    borderRadius: "5px",
                                    fontWeight: "bold",
                                }}
                            >
                                Project Request
                            </Chip>
                        )}
                        {inboxItem.itemType === 3 && (
                            <Chip
                                key={`inbox-bubble-chip-${inboxItem.itemId}-${inboxItem.tsSent}`}
                                color="neutral"
                                size="md"
                                variant="soft"
                                sx={{
                                    marginRight: "auto",
                                    borderRadius: "5px",
                                    fontWeight: "bold",
                                }}
                            >
                                GM Request
                            </Chip>
                        )}

                        <Typography fontWeight="bold" level="body-xs">
                            {extractYYYYMMDDHHMM(inboxItem.tsSent)}
                        </Typography>
                    </Stack>

                    {inboxItem.itemBody[0].content.length > 0 && (
                        <BnChatPreview
                            key={`${inboxItem.itemType}-${inboxItem.itemId}-${inboxItem.tsSent}`}
                            useCM={useCM}
                            content={inboxItem.itemBody}
                            customClassName="inbox-preview"
                            isSent={true}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    )}

                    {(inboxItem.itemType === 1 ||
                        inboxItem.itemType === 2 ||
                        inboxItem.itemType === 3) &&
                        (inboxItem.isRead === true || requestApproved === true) && (
                            <Button
                                key={`inbox-approved-button-${inboxItem.itemType}-${inboxItem.itemId}`}
                                color="neutral"
                                disabled={true}
                                size="sm"
                                sx={{ width: "100px", alignSelf: "flex-end" }}
                                variant="outlined"
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
                                size="sm"
                                sx={{ width: "100px", alignSelf: "flex-end" }}
                                variant="soft"
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
