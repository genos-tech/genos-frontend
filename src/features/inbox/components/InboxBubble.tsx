import { useState } from "react";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import { Box, Button, Card, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../components/editors/bnChatPreview";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { fmt, getMessages, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import { UserProps } from "../../../types/admin";
import { InboxItemProps } from "../../../types/common";
import { extractYYYYMMDDHHMM } from "../../../utils/dateUtils";

// Item type configurations for cleaner code. `colorScheme` is intentionally
// NOT mapped to the unified purple palette — each request type needs a
// distinct hue (Team=blue, Project=green, GM=pink, Note=amber) so the user
// can tell request types apart at a glance in a dense inbox.
type RequestLabelKey = "teamRequest" | "projectRequest" | "gmRequest" | "noteAccessRequest";

const ITEM_TYPE_CONFIG: Record<
    number,
    {
        labelKey: RequestLabelKey;
        icon: React.ReactNode;
        approveEvent: string;
        rejectEvent: string;
        colorScheme: { dark: string; light: string };
    }
> = {
    1: {
        labelKey: "teamRequest",
        icon: <GroupsRoundedIcon sx={{ fontSize: 14 }} />,
        approveEvent: "approve_join_team_request",
        rejectEvent: "reject_join_team_request",
        colorScheme: { dark: "#60a5fa", light: "#3b82f6" },
    },
    2: {
        labelKey: "projectRequest",
        icon: <FolderRoundedIcon sx={{ fontSize: 14 }} />,
        approveEvent: "approve_join_project_request",
        rejectEvent: "reject_join_project_request",
        colorScheme: { dark: "#4ade80", light: "#22c55e" },
    },
    3: {
        labelKey: "gmRequest",
        icon: <ChatRoundedIcon sx={{ fontSize: 14 }} />,
        approveEvent: "approve_join_gm_request",
        rejectEvent: "reject_join_gm_request",
        colorScheme: { dark: "#f472b6", light: "#ec4899" },
    },
    4: {
        labelKey: "noteAccessRequest",
        icon: <StickyNote2RoundedIcon sx={{ fontSize: 14 }} />,
        approveEvent: "approve_note_access_request",
        rejectEvent: "reject_note_access_request",
        colorScheme: { dark: "#fbbf24", light: "#f59e0b" },
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
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const [localStatus, setLocalStatus] = useState<"approved" | "rejected" | null>(null);
    const [isHovered, setIsHovered] = useState<boolean>(false);

    const config = ITEM_TYPE_CONFIG[inboxItem.itemType];
    const isRequest = inboxItem.itemType >= 1 && inboxItem.itemType <= 4;
    const resolvedStatus = localStatus ?? inboxItem.requestStatus;
    const isHandled = resolvedStatus === "approved" || resolvedStatus === "rejected";

    const handleApprove = () => {
        if (socket && config) {
            socket.emit(config.approveEvent, { item_id: inboxItem.itemId });
            setLocalStatus("approved");
        }
    };

    const handleReject = () => {
        if (socket && config) {
            socket.emit(config.rejectEvent, { item_id: inboxItem.itemId });
            setLocalStatus("rejected");
        }
    };

    return (
        <Card
            variant="outlined"
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
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
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
                            startDecorator={config.icon}
                            variant="soft"
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
                            {t.inbox.requestTypes[config.labelKey]}
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
                            content={inboxItem.itemBody}
                            customClassName="inbox-preview"
                            isSent={true}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Box>
                )}

                {/* Action Buttons */}
                {isRequest && (
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                        {isHandled ? (
                            <Button
                                color={resolvedStatus === "rejected" ? "neutral" : "success"}
                                size="sm"
                                variant="soft"
                                startDecorator={
                                    resolvedStatus === "rejected" ? (
                                        <CloseRoundedIcon sx={{ fontSize: 16 }} />
                                    ) : (
                                        <CheckRoundedIcon sx={{ fontSize: 16 }} />
                                    )
                                }
                                sx={{
                                    borderRadius: "10px",
                                    fontWeight: 600,
                                    fontSize: "0.75rem",
                                    px: 2,
                                    py: 0.75,
                                    background:
                                        resolvedStatus === "rejected"
                                            ? palette.dangerTintBg
                                            : palette.successTintBg,
                                    color:
                                        resolvedStatus === "rejected"
                                            ? palette.dangerTint
                                            : palette.successTint,
                                    "&.Mui-disabled": {
                                        opacity: 0.9,
                                    },
                                }}
                                disabled
                            >
                                {resolvedStatus === "rejected"
                                    ? t.inbox.bubble.rejected
                                    : t.inbox.bubble.approved}
                            </Button>
                        ) : (
                            <>
                                <Button
                                    color="danger"
                                    size="sm"
                                    startDecorator={<CloseRoundedIcon sx={{ fontSize: 16 }} />}
                                    variant="outlined"
                                    sx={{
                                        borderRadius: "10px",
                                        fontWeight: 600,
                                        fontSize: "0.75rem",
                                        px: 2,
                                        py: 0.75,
                                        borderColor: palette.dangerTintBorder,
                                        color: palette.dangerTint,
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            background: palette.dangerTintBg,
                                            borderColor: palette.dangerTintBorder,
                                            transform: "translateY(-1px)",
                                        },
                                        "&:active": {
                                            transform: "translateY(0)",
                                        },
                                    }}
                                    onClick={handleReject}
                                >
                                    {t.inbox.bubble.reject}
                                </Button>
                                <Button
                                    size="sm"
                                    startDecorator={<CheckRoundedIcon sx={{ fontSize: 16 }} />}
                                    variant="solid"
                                    sx={{
                                        borderRadius: "10px",
                                        fontWeight: 600,
                                        fontSize: "0.75rem",
                                        px: 2.5,
                                        py: 0.75,
                                        background: palette.primaryButtonBg,
                                        boxShadow: palette.primaryButtonShadow,
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            background: palette.primaryButtonHover,
                                            transform: "translateY(-1px)",
                                            boxShadow: isDark
                                                ? "0 6px 16px rgba(124,58,237,0.5)"
                                                : "0 6px 16px rgba(124,58,237,0.4)",
                                        },
                                        "&:active": {
                                            transform: "translateY(0)",
                                        },
                                    }}
                                    onClick={handleApprove}
                                >
                                    {t.inbox.bubble.approve}
                                </Button>
                            </>
                        )}
                    </Stack>
                )}
            </Stack>
        </Card>
    );
};

// Export helper for generating approval notification body
export const getItemBody = (requestType: number, targetName: string) => {
    const messages = getMessages();
    const requestNameLookUp: Record<number, string> = {
        1: messages.inbox.requestTargets.team,
        2: messages.inbox.requestTargets.project,
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
                    text: fmt(messages.inbox.notification.approvalBody, {
                        target: requestNameLookUp[requestType],
                    }),
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
