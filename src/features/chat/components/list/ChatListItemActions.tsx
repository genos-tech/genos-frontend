import ChecklistIcon from "@mui/icons-material/Checklist";
import CircleIcon from "@mui/icons-material/Circle";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PushPinIcon from "@mui/icons-material/PushPin";
import { Badge, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import React from "react";

import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { extractYYYYMMDDHHMM } from "../../../../utils/dateUtils";

interface ChatListItemActionsProps {
    chat: AllChatProps;
    myself: UserProps;
    incompleteTodoCount: number;
    isPinned: boolean;
    onPinClick: (event: React.MouseEvent) => void;
    onSplitClick: (event: React.MouseEvent) => void;
    onTodoClick: () => void;
}

export const ChatListItemActions: React.FC<ChatListItemActionsProps> = ({
    chat,
    myself,
    incompleteTodoCount,
    isPinned,
    onPinClick,
    onSplitClick,
    onTodoClick,
}) => {
    return (
        <Stack alignItems="center" direction="row">
            <Typography
                level="body-xs"
                sx={{ display: { xs: "none", md: "block" }, mt: 0.6, mr: 1 }}
                noWrap
            >
                {chat.latestMessage ? extractYYYYMMDDHHMM(chat.latestMessage.tsSent) : ""}
            </Typography>

            {/* To-Do Button */}
            {chat.dmPartnerUser.userId === myself.userId && (
                <Tooltip size="sm" title="To-Do" variant="outlined">
                    <Badge
                        anchorOrigin={{ vertical: "top", horizontal: "right" }}
                        badgeContent={incompleteTodoCount}
                        color="primary"
                        size="sm"
                        sx={{ "& .JoyBadge-badge": { zIndex: 1 }, mt: 0.6 }}
                    >
                        <IconButton
                            color="neutral"
                            component="a"
                            size="sm"
                            sx={{ mr: -1 }}
                            variant="plain"
                            onClick={onTodoClick}
                        >
                            <ChecklistIcon />
                        </IconButton>
                    </Badge>
                </Tooltip>
            )}

            {/* Pin Button */}
            <Tooltip
                size="sm"
                title={chat.isPinned ? "Unpin Chat" : "Pin Chat"}
                variant="outlined"
            >
                <IconButton
                    color={chat.isPinned ? "danger" : "neutral"}
                    component="a"
                    sx={{ mr: -1, mt: 0.6 }}
                    onClick={onPinClick}
                >
                    <PushPinIcon sx={{ fontSize: isPinned ? 18 : 16 }} />
                </IconButton>
            </Tooltip>

            {/* Split View Button */}
            <Tooltip size="sm" title="Split View" variant="outlined">
                <IconButton component="a" sx={{ mt: 0.6 }} onClick={onSplitClick}>
                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Tooltip>

            {/* Unread Indicator */}
            {chat.latestMessage && chat.lastReadMessageId < chat.latestMessage?.messageId && (
                <CircleIcon color="primary" sx={{ mr: 1, fontSize: 12, mt: 0.5 }} />
            )}
        </Stack>
    );
};
