import React from "react";
import CircleIcon from "@mui/icons-material/Circle";
import { Box, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../types/admin";
import { ActivityMessageProps, AllChatProps } from "../../../../../types/chat";
import { extractYYYYMMDDHHMM } from "../../../../../utils/dateUtils";
import { ActivityAvatar } from "./ActivityAvatar";
import { ActivityTypeChips } from "./ActivityTypeChips";

interface ActivityHeaderProps {
    activity: ActivityMessageProps;
    myself: UserProps;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    allChats: AllChatProps[];
    setCurrentMainChat: (chat: any) => void;
    setMyself: (value: UserProps) => void;
    UIM: UIStateManagementState;
    funcSetAllChats: () => Promise<void>;
    isYou: boolean;
    chatTypeLookup: { [key: number]: string };
}

export const ActivityHeader: React.FC<ActivityHeaderProps> = ({
    activity,
    myself,
    teamMemberProfiles,
    socket,
    allChats,
    setCurrentMainChat,
    setMyself,
    UIM,
    funcSetAllChats,
    isYou,
    chatTypeLookup,
}) => {
    return (
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1.5}>
            <Stack direction="row" spacing={1}>
                <ActivityAvatar
                    activity={activity}
                    allChats={allChats}
                    funcSetAllChats={funcSetAllChats}
                    isYou={isYou}
                    myself={myself}
                    setCurrentMainChat={setCurrentMainChat}
                    setMyself={setMyself}
                    UIM={UIM}
                    socket={socket}
                    teamMemberProfiles={teamMemberProfiles}
                />

                {activity.chatType !== 3 && activity.chatType !== 4 && (
                    <Box>
                        <Typography level="title-sm" noWrap>
                            {isYou ? `${activity.chatName} (you)` : activity.chatName}
                        </Typography>
                    </Box>
                )}

                <ActivityTypeChips activity={activity} chatTypeLookup={chatTypeLookup} />
            </Stack>

            {/* Right-aligned content */}
            <Stack alignItems="center" direction="row" spacing={1}>
                <Typography level="body-xs" sx={{ display: { xs: "none", md: "block" } }} noWrap>
                    {extractYYYYMMDDHHMM(activity.tsSent)}
                </Typography>
                {activity.isRead === false && <CircleIcon color="primary" sx={{ fontSize: 12 }} />}
            </Stack>
        </Stack>
    );
};
