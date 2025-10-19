import React from "react";
import { Chip, Stack } from "@mui/joy";

import { ActivityMessageProps } from "../../../../../types/chat";

interface ActivityTypeChipsProps {
    activity: ActivityMessageProps;
    chatTypeLookup: { [key: number]: string };
}

export const ActivityTypeChips: React.FC<ActivityTypeChipsProps> = ({
    activity,
    chatTypeLookup,
}) => {
    return (
        <Stack direction="row" spacing={0.3} flexWrap="wrap">
            {/* Chat Name and Task ID for PM and Task */}
            {(activity.chatType === 3 || activity.chatType === 4) && (
                <>
                    <Chip
                        color="primary"
                        size="sm"
                        variant="soft"
                        sx={{
                            height: "24px",
                            fontSize: "12px",
                            borderRadius: "4px",
                            fontWeight: "bold",
                        }}
                    >
                        {activity.chatName}
                    </Chip>
                    <Chip
                        size="sm"
                        variant="soft"
                        sx={{
                            height: "24px",
                            fontSize: "12px",
                            borderRadius: "4px",
                            fontWeight: "bold",
                        }}
                    >
                        ID:{activity.taskId}
                    </Chip>
                </>
            )}

            {/* Activity Type Chips */}
            {activity.activityType === 1 && activity.chatType !== 4 && (
                <Chip
                    color="success"
                    size="sm"
                    variant="outlined"
                    sx={{
                        height: "24px",
                        fontSize: "12px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                    }}
                >
                    Reply
                </Chip>
            )}

            {activity.activityType === 2 && (
                <Chip
                    color="warning"
                    size="sm"
                    variant="outlined"
                    sx={{
                        height: "24px",
                        fontSize: "12px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                    }}
                >
                    Reaction
                </Chip>
            )}

            {activity.activityType === 3 && (
                <Chip
                    color="danger"
                    size="sm"
                    variant="outlined"
                    sx={{
                        height: "24px",
                        fontSize: "12px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                    }}
                >
                    Mention
                </Chip>
            )}

            {/* Chat Type Chip */}
            <Chip
                color="neutral"
                size="sm"
                variant="outlined"
                sx={{
                    height: "24px",
                    fontSize: "12px",
                    borderRadius: "4px",
                    fontWeight: "bold",
                }}
            >
                {chatTypeLookup[activity.chatType]}
            </Chip>

            {/* Thread Chip */}
            {activity.isThread === true && (
                <Chip
                    color="neutral"
                    size="sm"
                    variant="outlined"
                    sx={{
                        height: "24px",
                        fontSize: "12px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                    }}
                >
                    Thread
                </Chip>
            )}
        </Stack>
    );
};
