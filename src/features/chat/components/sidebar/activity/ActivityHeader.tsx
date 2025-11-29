import React from "react";
import CircleIcon from "@mui/icons-material/Circle";
import { Box, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../types/admin";
import { ActivityMessageProps } from "../../../../../types/chat";
import { extractYYYYMMDDHHMM } from "../../../../../utils/dateUtils";
import { ActivityAvatar } from "./ActivityAvatar";
import { ActivityTypeChips } from "./ActivityTypeChips";

interface ActivityHeaderProps {
    useTEM: TeamManagementState;
    activity: ActivityMessageProps;
    myself: UserProps;
    socket: Socket | null;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    isYou: boolean;
    chatTypeLookup: { [key: number]: string };
    useCM: ChatManagementState;
}

export const ActivityHeader: React.FC<ActivityHeaderProps> = ({
    useTEM,
    activity,
    myself,
    socket,
    setMyself,
    useUISM,
    isYou,
    chatTypeLookup,
    useCM,
}) => {
    return (
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1.5}>
            <Stack direction="row" spacing={1}>
                <ActivityAvatar
                    activity={activity}
                    useCM={useCM}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
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
