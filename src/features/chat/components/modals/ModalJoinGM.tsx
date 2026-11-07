import React, { useState } from "react";
import GroupsIcon from "@mui/icons-material/Groups";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import SendIcon from "@mui/icons-material/Send";
import { Alert, Box, Button, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../../context/AuthContext";
import { getMessages, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";

const base_url = import.meta.env.VITE_API_BASE_URL;
const disableOpenJoinGMParams = {
    flag: false,
    chatId: "",
    chatName: "",
};

type Props = {
    socket: Socket | null;
    myself: UserProps;
    openJoinGM: {
        flag: boolean;
        chatId: string;
        chatName: string;
    };
    setOpenJoinGM: (value: { flag: boolean; chatId: string; chatName: string }) => void;
};
export const ModalJoinGM: React.FC<Props> = ({ socket, myself, openJoinGM, setOpenJoinGM }) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function joinGM(): Promise<void> {
        const msgs = getMessages();
        try {
            if (socket !== null) {
                socket.emit(
                    "join_gm_request",
                    {
                        joiningGMId: openJoinGM.chatId,
                        joiningGMName: openJoinGM.chatName,
                    },
                    async (ack: any) => {
                        const item_body = [
                            {
                                type: "paragraph",
                                props: {
                                    textColor: "default",
                                    textAlignment: "left",
                                    backgroundColor: "default",
                                },
                                content: [
                                    {
                                        text: msgs.chat.modals.joinGM.joinRequestPrefix,
                                        type: "text",
                                        styles: {},
                                    },
                                    {
                                        text: openJoinGM.chatName,
                                        type: "text",
                                        styles: { bold: true, textColor: "pink" },
                                    },
                                    {
                                        text: msgs.chat.modals.joinGM.joinRequestSuffix,
                                        type: "text",
                                        styles: {},
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

                        const sendInboxMessageResponse = await fetch(`${base_url}/inbox/`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${accessToken}`,
                            },
                            body: JSON.stringify({
                                team_id: myself.teamId,
                                sender_id: myself.userId,
                                receiver_id: myself.userId,
                                item_body: item_body,
                                item_type: 0,
                            }),
                        });
                        if (!sendInboxMessageResponse.ok) {
                            throw new Error(msgs.chat.modals.joinGM.sendInboxError);
                        }
                    }
                );
                setOpenJoinGM(disableOpenJoinGMParams);
            } else {
                const err_msg: string = msgs.chat.modals.joinGM.socketNotFound;
                console.error(err_msg);
                setErrorMessage(err_msg);
                throw new Error(err_msg);
            }
        } catch (error) {
            const err_msg = `${error}`;
            console.error(err_msg);
            setErrorMessage(err_msg);
        }
    }

    const handleJoinGM = () => {
        joinGM();
    };

    return (
        <ModalFrame
            icon={<GroupsIcon sx={{ color: g.accent.text }} />}
            open={openJoinGM.flag}
            size="sm"
            title={t.chat.modals.joinGM.requestToJoin}
            zIndex={10010}
            actions={
                <>
                    <Button
                        color="neutral"
                        variant="plain"
                        onClick={() => setOpenJoinGM(disableOpenJoinGMParams)}
                    >
                        {t.chat.modals.joinGM.cancel}
                    </Button>
                    <Button
                        endDecorator={<SendIcon sx={{ fontSize: 16 }} />}
                        onClick={handleJoinGM}
                    >
                        {t.chat.modals.joinGM.sendRequest}
                    </Button>
                </>
            }
            onClose={() => setOpenJoinGM(disableOpenJoinGMParams)}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <LockOutlineIcon sx={{ color: g.text.tertiary, fontSize: 16 }} />
                <Typography
                    level="body-xs"
                    sx={{
                        color: g.text.secondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                    }}
                >
                    {t.chat.modals.joinGM.privateGroupLabel}
                </Typography>
            </Box>

            <Typography
                level="title-lg"
                sx={{ color: g.text.primary, mb: 1, overflowWrap: "anywhere" }}
            >
                {openJoinGM.chatName}
            </Typography>

            {/* Error Alert */}
            {errorMessage && (
                <Alert color="danger" sx={{ mt: 1 }}>
                    {errorMessage}
                </Alert>
            )}
        </ModalFrame>
    );
};
