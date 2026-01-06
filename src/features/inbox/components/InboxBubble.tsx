import { useState } from "react";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import { Box, Button, Card, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../components/editors/bnChatPreview";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../types/admin";
import { InboxItemProps } from "../../../types/common";
import { extractYYYYMMDDHHMM } from "../../../utils/dateUtils";

// Item type configurations for cleaner code
const ITEM_TYPE_CONFIG: Record<
    number,
    {
        label: string;
        icon: React.ReactNode;
        socketEvent: string;
        colorScheme: { dark: string; light: string };
    }
> = {
    1: {
        label: "Team Request",
        icon: <GroupsRoundedIcon sx={{ fontSize: 14 }} />,
        socketEvent: "approve_join_team_request",
        colorScheme: { dark: "#60a5fa", light: "#3b82f6" },
    },
    2: {
        label: "Project Request",
        icon: <FolderRoundedIcon sx={{ fontSize: 14 }} />,
        socketEvent: "approve_join_project_request",
        colorScheme: { dark: "#4ade80", light: "#22c55e" },
    },
    3: {
        label: "GM Request",
        icon: <ChatRoundedIcon sx={{ fontSize: 14 }} />,
        socketEvent: "approve_join_gm_request",
        colorScheme: { dark: "#f472b6", light: "#ec4899" },
    },
};

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
    const isDark = mode === "dark";
    const [requestApproved, setRequestApproved] = useState<boolean>(false);
    const [isHovered, setIsHovered] = useState<boolean>(false);

    const config = ITEM_TYPE_CONFIG[inboxItem.itemType];
    const isApproved = inboxItem.isRead === true || requestApproved === true;
    const isRequest = inboxItem.itemType >= 1 && inboxItem.itemType <= 3;

    const handleApprove = () => {
        if (socket && config) {
            socket.emit(config.socketEvent, { item_id: inboxItem.itemId });
            setRequestApproved(true);
        }
    };

    return (
        <Card
            variant="outlined"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            sx={{
                p: 2,
                background: isDark
                    ? isHovered
                        ? "linear-gradient(135deg, rgba(35,35,45,0.95) 0%, rgba(30,30,40,0.98) 100%)"
                        : "linear-gradient(135deg, rgba(28,28,35,0.9) 0%, rgba(24,24,30,0.95) 100%)"
                    : isHovered
                      ? "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(250,250,255,1) 100%)"
                      : "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(252,252,255,1) 100%)",
                border: "1px solid",
                borderColor: isHovered
                    ? isDark
                        ? "rgba(139,92,246,0.25)"
                        : "rgba(124,58,237,0.15)"
                    : isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.06)",
                borderRadius: "14px",
                boxShadow: isHovered
                    ? isDark
                        ? "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(139,92,246,0.1)"
                        : "0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(124,58,237,0.05)"
                    : isDark
                      ? "0 2px 8px rgba(0,0,0,0.2)"
                      : "0 2px 8px rgba(0,0,0,0.04)",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Subtle glow effect on hover */}
            {isHovered && (
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "1px",
                        background: isDark
                            ? "linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.5) 50%, transparent 100%)"
                            : "linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.3) 50%, transparent 100%)",
                    }}
                />
            )}

            <Stack spacing={1.5}>
                {/* Header Row */}
                <Stack alignItems="center" direction="row" justifyContent="space-between">
                    {config && (
                        <Chip
                            size="sm"
                            variant="soft"
                            startDecorator={config.icon}
                            sx={{
                                borderRadius: "8px",
                                fontWeight: 600,
                                fontSize: "0.7rem",
                                px: 1,
                                py: 0.25,
                                background: isDark
                                    ? `linear-gradient(135deg, ${config.colorScheme.dark}15 0%, ${config.colorScheme.dark}08 100%)`
                                    : `linear-gradient(135deg, ${config.colorScheme.light}12 0%, ${config.colorScheme.light}06 100%)`,
                                color: isDark ? config.colorScheme.dark : config.colorScheme.light,
                                border: "1px solid",
                                borderColor: isDark
                                    ? `${config.colorScheme.dark}25`
                                    : `${config.colorScheme.light}20`,
                                "& .MuiChip-startDecorator": {
                                    color: "inherit",
                                },
                            }}
                        >
                            {config.label}
                        </Chip>
                    )}

                    <Typography
                        level="body-xs"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                            fontSize: "0.7rem",
                            fontWeight: 500,
                        }}
                    >
                        {extractYYYYMMDDHHMM(inboxItem.tsSent)}
                    </Typography>
                </Stack>

                {/* Content */}
                {inboxItem.itemBody[0]?.content?.length > 0 && (
                    <Box
                        sx={{
                            "& .inbox-preview": {
                                fontSize: "0.85rem",
                                color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
                            },
                        }}
                    >
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
                    </Box>
                )}

                {/* Action Button */}
                {isRequest && (
                    <Stack direction="row" justifyContent="flex-end">
                        {isApproved ? (
                            <Button
                                size="sm"
                                variant="soft"
                                color="success"
                                disabled
                                startDecorator={<CheckRoundedIcon sx={{ fontSize: 16 }} />}
                                sx={{
                                    borderRadius: "10px",
                                    fontWeight: 600,
                                    fontSize: "0.75rem",
                                    px: 2,
                                    py: 0.75,
                                    background: isDark
                                        ? "rgba(74,222,128,0.12)"
                                        : "rgba(34,197,94,0.1)",
                                    color: isDark ? "#4ade80" : "#16a34a",
                                    "&.Mui-disabled": {
                                        opacity: 0.9,
                                    },
                                }}
                            >
                                Approved
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                variant="solid"
                                onClick={handleApprove}
                                sx={{
                                    borderRadius: "10px",
                                    fontWeight: 600,
                                    fontSize: "0.75rem",
                                    px: 2.5,
                                    py: 0.75,
                                    background: isDark
                                        ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                                        : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                                    boxShadow: isDark
                                        ? "0 4px 12px rgba(99,102,241,0.35)"
                                        : "0 4px 12px rgba(79,70,229,0.3)",
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        background: isDark
                                            ? "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)"
                                            : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                                        transform: "translateY(-1px)",
                                        boxShadow: isDark
                                            ? "0 6px 16px rgba(99,102,241,0.45)"
                                            : "0 6px 16px rgba(79,70,229,0.4)",
                                    },
                                    "&:active": {
                                        transform: "translateY(0)",
                                    },
                                }}
                            >
                                Approve
                            </Button>
                        )}
                    </Stack>
                )}
            </Stack>
        </Card>
    );
};

// Export helper for generating approval notification body
export const getItemBody = (requestType: number, targetName: string) => {
    const requestNameLookUp: Record<number, string> = {
        1: "team",
        2: "project",
    };

    return [
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
};
