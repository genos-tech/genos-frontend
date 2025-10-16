import React from "react";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import { Box, Chip, Stack, Typography } from "@mui/joy";

import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";

interface ChatListItemTitleProps {
    chat: AllChatProps;
    isYou: boolean;
    myself: UserProps;
    teamMemberProfiles: Record<string, UserProps>;
}

export const ChatListItemTitle: React.FC<ChatListItemTitleProps> = ({
    chat,
    isYou,
    myself,
    teamMemberProfiles,
}) => {
    const showMyCustomStatus =
        chat.dmPartnerUser.userId !== "" &&
        myself.userId === chat.dmPartnerUser.userId &&
        myself.customStatus !== "";

    const showOthersCustomStatus =
        chat.dmPartnerUser.userId !== "" &&
        myself.userId !== chat.dmPartnerUser.userId &&
        teamMemberProfiles[chat.dmPartnerUser.userId] &&
        teamMemberProfiles[chat.dmPartnerUser.userId].customStatus !== "";

    return (
        <Box sx={{ pt: "3px" }}>
            <Stack direction="row" spacing={0.5}>
                <Typography
                    level="title-sm"
                    sx={{ pl: "5px" }}
                    startDecorator={
                        chat.isPrivate ? <LockOutlineIcon sx={{ fontSize: "16px" }} /> : undefined
                    }
                    noWrap
                >
                    {isYou ? `${chat.chatName} (you)` : chat.chatName}
                </Typography>

                {/* Show my own custom status */}
                {showMyCustomStatus && (
                    <Chip
                        component="h3"
                        size="sm"
                        sx={{ borderRadius: "sm", height: "10px" }}
                        variant="outlined"
                    >
                        {myself.customStatus}
                    </Chip>
                )}

                {/* Show others custom status */}
                {showOthersCustomStatus && (
                    <Chip
                        component="h3"
                        size="sm"
                        sx={{ borderRadius: "sm", height: "10px" }}
                        variant="outlined"
                    >
                        {teamMemberProfiles[chat.dmPartnerUser.userId].customStatus}
                    </Chip>
                )}
            </Stack>
        </Box>
    );
};
